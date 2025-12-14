import { BadRequestException, Injectable, ConflictException, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { ReferralCode } from './schemas/referral-code.schema';
import { Referral } from './schemas/referral.schema';
import { ReferralReward } from './schemas/referral-reward.schema';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function toBase62(buffer: Buffer, length = 8) {
  // Convert buffer to a big integer then encode in base62; fallback to simple filter if needed
  let num = BigInt('0');
  for (let i = 0; i < buffer.length; i++) {
    num = (num << BigInt(8)) + BigInt(buffer[i]);
  }
  let out = '';
  while (out.length < length) {
    const idx = Number(num % BigInt(62));
    out += BASE62_ALPHABET[idx];
    num = num / BigInt(62);
    if (num === BigInt(0) && out.length < length) {
      // pad with random chars to desired length
      const rand = crypto.randomBytes(4);
      for (let j = 0; j < rand.length && out.length < length; j++) {
        out += BASE62_ALPHABET[rand[j] % 62];
      }
      break;
    }
  }
  return out.substring(0, length);
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectModel(ReferralCode.name) private readonly codeModel: Model<ReferralCode>,
    @InjectModel(Referral.name) private readonly referralModel: Model<Referral>,
    @InjectModel(ReferralReward.name) private readonly rewardModel: Model<ReferralReward>,
    private readonly usersService: UsersService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // generate a cryptographically-random base62 token of given length (default 8)
  private generateToken(length = 8): string {
    const bytes = crypto.randomBytes(Math.max(6, Math.ceil((length * Math.log2(62)) / 8)));
    return toBase62(bytes, length);
  }

  async createCode(inviterId: string, usageLimit = 0, expiresAt?: Date, campaign?: string) {
    // attempt to generate unique code, retry on duplicate
    for (let i = 0; i < 5; i++) {
      const code = this.generateToken();
      try {
        const created = await this.codeModel.create({
          code,
          inviterId,
          usageLimit,
          remainingUses: usageLimit || 0,
          expiresAt: expiresAt || null,
          campaign: campaign || null,
        });
        return created;
      } catch (err: any) {
        // duplicate key? retry
        if (err && err.code === 11000) continue;
        this.logger.error('createCode error', err?.stack || err);
        throw err;
      }
    }
    throw new ConflictException('Failed to generate unique referral code');
  }

  async getCode(code: string) {
    return this.codeModel.findOne({ code }).lean();
  }

  async redeemCode({ userId, code, source = {} }: { userId?: string; code: string; source?: any }) {
    // basic validation
    const now = new Date();
    const referralCode = await this.codeModel.findOne({ code });
    if (!referralCode) throw new BadRequestException('Invalid referral code');
    if (!referralCode.active) throw new BadRequestException('Referral code not active');
    if (referralCode.expiresAt && referralCode.expiresAt < now) throw new BadRequestException('Referral code expired');

    if (userId && referralCode.inviterId.toString() === userId) {
      throw new BadRequestException('Self-referral is not allowed');
    }

    // try to atomically decrement remainingUses if usageLimit set
    if (referralCode.usageLimit > 0) {
      const updated = await this.codeModel.findOneAndUpdate(
        { _id: referralCode._id, remainingUses: { $gt: 0 }, active: true },
        { $inc: { remainingUses: -1 } },
        { new: true },
      );
      if (!updated) throw new BadRequestException('Referral code usage limit reached');
    }

    // create referral entry; ensure invitee isn't already referred
    if (userId) {
      const exists = await this.referralModel.findOne({ inviteeId: userId });
      if (exists) throw new BadRequestException('User already has a referral');
    }

    const created = await this.referralModel.create({
      codeId: referralCode._id,
      inviterId: referralCode.inviterId,
      inviteeId: userId || null,
      inviteeEmail: null,
      status: 'pending',
      rewardApplied: false,
      source,
    });

    return created;
  }

  async getReferralsForUser(userId: string) {
    const inviterReferrals = await this.referralModel.find({ inviterId: userId }).lean();
    const inviteeReferral = await this.referralModel.findOne({ inviteeId: userId }).lean();
    const rewards = await this.rewardModel.find({ userId }).lean();
    return { inviterReferrals, inviteeReferral, rewards };
  }

  /**
   * Process a completion event for an invitee (e.g., email verified, first purchase)
   * This method finds a pending referral for the invitee and applies rewards transactionally.
   */
  async completeReferralForInvitee(inviteeId: string, eventType: string) {
    // Define referral rewards (could be moved to config)
    const INVITER_REWARD = 25; // credits
    const INVITEE_REWARD = 50; // credits
    const INVITER_MONTHLY_CAP = 100; // credits per month

    // find pending referral
    const referral = await this.referralModel.findOne({ inviteeId, status: 'pending' });
    if (!referral) return { processed: 0, reason: 'no_pending_referral' };
    if (referral.rewardApplied) return { processed: 0, reason: 'already_applied' };

    const session = await this.connection.startSession();
    try {
      let appliedInviterReward = 0;
      let appliedInviteeReward = 0;
      await session.withTransaction(async () => {
        // re-fetch inside session to ensure we have up-to-date document
        const ref = await this.referralModel.findOne({ _id: referral._id }).session(session);
        if (!ref) throw new Error('referral_missing');
        if (ref.rewardApplied) throw new Error('already_applied');

        const inviterId = ref.inviterId.toString();

        // check monthly cap for inviter
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const inviterRewardsThisMonth = await this.rewardModel.countDocuments({
          userId: inviterId,
          status: 'applied',
          createdAt: { $gte: startOfMonth },
        }).session(session);

        // Simple cap check - if too many reward records, skip inviter reward
        if (inviterRewardsThisMonth * INVITER_REWARD < INVITER_MONTHLY_CAP) {
          // apply inviter reward
          const inviterReward = await this.rewardModel.create([
            {
              referralId: ref._id,
              userId: inviterId,
              rewardType: 'credit',
              amount: INVITER_REWARD,
              status: 'applied',
            },
          ], { session });
          // increment inviter credits
          await this.usersService.incrementCredits(inviterId, INVITER_REWARD, session);
          appliedInviterReward = INVITER_REWARD;
        }

        // apply invitee reward
        const inviteeIdStr = ref.inviteeId.toString();
        const inviteeReward = await this.rewardModel.create([
          {
            referralId: ref._id,
            userId: inviteeIdStr,
            rewardType: 'credit',
            amount: INVITEE_REWARD,
            status: 'applied',
          },
        ], { session });
        await this.usersService.incrementCredits(inviteeIdStr, INVITEE_REWARD, session);
        appliedInviteeReward = INVITEE_REWARD;

        // mark referral completed
        ref.status = 'completed';
        ref.rewardApplied = true;
        await ref.save({ session });
      });

      await session.endSession();
      return { processed: 1, inviterAwarded: appliedInviterReward, inviteeAwarded: appliedInviteeReward };
    } catch (err: any) {
      await session.abortTransaction();
      await session.endSession();
      this.logger.error('completeReferralForInvitee error', err?.stack || err);
      throw err;
    }
  }

  async validateAndGetInviter(code: string) {
    const referralCode = await this.codeModel.findOne({ code }).lean();
    
    if (!referralCode) {
      return {
        valid: false,
        code,
        error: 'Referral code not found',
      };
    }

    // Check if expired
    if (referralCode.expiresAt && new Date(referralCode.expiresAt) < new Date()) {
      return {
        valid: false,
        code,
        error: 'Referral code has expired',
      };
    }

    // Check usage limit
    if (referralCode.usageLimit > 0 && referralCode.remainingUses <= 0) {
      return {
        valid: false,
        code,
        error: 'Referral code usage limit reached',
      };
    }

    // Get inviter details
    const inviter = await this.usersService.findById(referralCode.inviterId.toString());
    
    if (!inviter) {
      return {
        valid: false,
        code,
        error: 'Inviter not found',
      };
    }

    return {
      valid: true,
      code,
      inviter: {
        id: (inviter as any)._id,
        username: (inviter as any).username || `User`,
        firstName: (inviter as any).firstName || 'User',
        profileImageUrl: (inviter as any).profileImageUrl,
        skills: (inviter as any).skills || [],
      },
      bonus: {
        inviterPoints: 100,
        inviteePoints: 50,
      },
    };
  }
}
