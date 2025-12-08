import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { RedeemReferralDto } from './dto/redeem-referral.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompleteReferralDto } from './dto/complete-referral.dto';
import { UnauthorizedException } from '@nestjs/common';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('codes')
  async createCode(@Req() req: any, @Body() dto: CreateReferralCodeDto) {
    const inviterId = req.user?.sub || req.user?.userId;
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    const created = await this.referralsService.createCode(inviterId, dto.usageLimit || 0, expiresAt, dto.campaign);
    return { code: created.code, codeId: created._id, expiresAt: created.expiresAt };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMine(@Req() req: any) {
    const userId = req.user?.sub || req.user?.userId;
    return this.referralsService.getReferralsForUser(userId);
  }

  @Post('redeem')
  async redeem(@Body() dto: RedeemReferralDto, @Req() req: any) {
    // redeem can be used during signup (unauthenticated) or by authenticated users
    const userId = req.user ? (req.user.sub || req.user.userId) : undefined;
    const created = await this.referralsService.redeemCode({ userId, code: dto.code, source: { ip: req.ip } });
    return { referralId: created._id, status: created.status };
  }

  // internal endpoint: process completion events for invitees
  @Post('complete')
  async complete(@Body() dto: CompleteReferralDto, @Req() req: any) {
    // require an internal API key set in env to prevent abuse
    const internalKey = process.env.INTERNAL_API_KEY;
    const header = req.get('x-internal-key');
    if (!internalKey || header !== internalKey) throw new UnauthorizedException();

    const res = await this.referralsService.completeReferralForInvitee(dto.userId, dto.eventType);
    return res;
  }
}
