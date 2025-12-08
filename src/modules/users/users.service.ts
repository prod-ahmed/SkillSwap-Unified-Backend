import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { randomInt } from 'crypto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { BadgeTier } from './dto/badge-tier.enum';

@Injectable()
export class UsersService {
  private readonly REFERRAL_XP = 10;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly mailService: MailService,
  ) { }

  // Create user
  async createUser(dto: CreateUserDto, image?: string): Promise<User> {
    const existingUser = await this.userModel.findOne({
      $or: [{ email: dto.email }],
    });
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const { referralCode, ...payload } = dto;
    let referrer: UserDocument | null = null;

    if (referralCode) {
      referrer = await this.findByReferralCode(referralCode);
      if (!referrer) {
        throw new BadRequestException('Referral code not found');
      }
      const limit = referrer.maxParannaige ?? 0;
      const currentCount = referrer.nombreParainnage ?? 0;
      if (limit > 0 && currentCount >= limit) {
        throw new BadRequestException('Referral limit reached');
      }
    }

    const createdUser = new this.userModel({
      ...payload,
      password: hashed,
      image,
    });

    await createdUser.save();

    if (referrer) {
      await this.applyReferralReward(referrer, createdUser);
    }

    return createdUser;
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.userModel.findOne({ email: new RegExp(`^${escapedEmail}$`, 'i') });
  }

  async findByUsername(username: string): Promise<UserDocument | null> {
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.userModel.findOne({ username: new RegExp(`^${escapedUsername}$`, 'i') }).exec();
  }

  async updateImage(username: string, image: string) {
    return this.userModel.findOneAndUpdate(
      { username },
      { image },
      { new: true },
    );
  }

  async findById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId);
  }

  async findByReferralCode(code: string): Promise<UserDocument | null> {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    return this.userModel.findOne({ codeParainnage: normalized });
  }

  async updateImageById(
    userId: string,
    filename: string,
  ): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(userId, { image: filename }, { new: true })
      .exec();
  }

  // Step 1: Send verification code
  async sendVerificationCodeById(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const code = String(randomInt(100000, 999999));
    user.verificationCode = code;
    await user.save();

    console.log(
      '✅ Sending verification email to:',
      user.email,
      'with code:',
      code,
    );
    try {
      await this.mailService.sendVerificationEmail(user.email, code);
      console.log('✅ Email sent successfully');
    } catch (err) {
      console.error('❌ Error sending email:', err);
      throw new Error('Email sending failed');
    }

    return { message: 'Verification code sent to email' };
  }


  // Step 2: Verify code
  async verifyEmailById(userId: string, code: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    if (user.verificationCode !== code) {
      throw new BadRequestException('Invalid verification code');
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    await user.save();

    return { message: 'Email verified successfully' };
  }

  async sendPasswordResetCode(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new BadRequestException('User not found');

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    await user.save();

    await this.mailService.sendMail({
      to: email,
      subject: 'Password Reset Code',
      text: `Your password reset code is ${resetCode}`,
    });

    return { message: 'Password reset code sent to your email' };
  }

  async resetPassword(
    code: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    const user = await this.userModel.findOne({ resetCode: code });
    if (!user) throw new BadRequestException('Invalid or expired code');

    if (newPassword !== confirmPassword)
      throw new BadRequestException('Passwords do not match');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetCode = undefined;
    await user.save();

    return { message: 'Password reset successful' };
  }

  async updateProfile(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const updates: Partial<User> = {};

    const simpleFields: (keyof UpdateUserDto)[] = [
      'username',
      'email',
      'bio',
      'skillsTeach',
      'skillsLearn',
    ];

    for (const field of simpleFields) {
      const value = dto[field];
      if (value !== undefined) {
        (updates as Record<string, unknown>)[field] = value;
      }
    }

    if (dto.location !== undefined) {
      updates.location = dto.location as any;
    }

    if (dto.password !== undefined) {
      updates.password = await bcrypt.hash(dto.password, 10);
    }

    if (Object.keys(updates).length === 0) {
      return user;
    }

    Object.assign(user, updates);
    await user.save();

    return user;
  }

  // Increment user credits atomically; accepts optional mongoose session
  async incrementCredits(userId: string, amount: number, session?: any) {
    if (!userId) throw new BadRequestException('Invalid user id');
    return this.userModel.updateOne({ _id: userId }, { $inc: { credits: amount } }, { session });
  }

  async validateReferralCode(codeParainnage: string) {
    const referrer = await this.findByReferralCode(codeParainnage);
    if (!referrer) {
      throw new BadRequestException('Referral code not found');
    }
    const limit = referrer.maxParannaige ?? 0;
    const currentCount = referrer.nombreParainnage ?? 0;
    if (currentCount >= limit && limit > 0) {
      throw new BadRequestException('Referral limit reached');
    }

    return {
      username: referrer.username,
      badges: referrer.badges ?? [],
      remainingSlots: Math.max(0, limit - currentCount),
    };
  }

  async getRewardsSummary(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      xp: user.xp,
      badges: user.badges,
      codeParainnage: user.codeParainnage,
      nombreParainnage: user.nombreParainnage,
      maxParannaige: user.maxParannaige,
      remainingSlots: Math.max(
        0,
        user.maxParannaige - user.nombreParainnage,
      ),
    };
  }

  private async applyReferralReward(
    referrer: UserDocument,
    referee: UserDocument,
  ) {
    if (!referrer || !referee || referrer.id === referee.id) {
      return;
    }

    const currentCount = referrer.nombreParainnage ?? 0;
    const limit = referrer.maxParannaige ?? 0;
    if (currentCount < limit) {
      referrer.nombreParainnage = currentCount + 1;
      const currentXp = referrer.xp ?? 0;
      referrer.xp = currentXp + this.REFERRAL_XP;
      referrer.badges = this.assignBadges(referrer.nombreParainnage);
    }

    const refereeXp = referee.xp ?? 0;
    referee.xp = refereeXp + this.REFERRAL_XP;

    await Promise.all([referrer.save(), referee.save()]);
  }

  private assignBadges(nombreParainnage: number): BadgeTier[] {
    const badges: BadgeTier[] = [];
    if (nombreParainnage >= 5) {
      badges.push(BadgeTier.Iron);
    }
    if (nombreParainnage >= 10) {
      badges.push(BadgeTier.Bronze);
    }
    if (nombreParainnage >= 15) {
      badges.push(BadgeTier.Silver);
    }
    if (nombreParainnage >= 20) {
      badges.push(BadgeTier.Gold);
    }

    return badges;
  }

  async searchUsers(currentUserId: string, query?: string) {
    const filter: any = { _id: { $ne: currentUserId } };
    
    // Add search filter if query is provided
    if (query && query.trim().length > 0) {
      const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedQuery, 'i');
      filter.$or = [
        { username: searchRegex },
        { email: searchRegex }
      ];
    }
    
    const users = await this.userModel
      .find(filter, { username: 1, email: 1, image: 1, _id: 1 })
      .limit(50)
      .lean()
      .exec();

    return users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      email: u.email,
      image: u.image,
    }));
  }

}
