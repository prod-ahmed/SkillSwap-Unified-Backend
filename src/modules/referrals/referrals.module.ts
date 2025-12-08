import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { ReferralCode, ReferralCodeSchema } from './schemas/referral-code.schema';
import { Referral, ReferralSchema } from './schemas/referral.schema';
import { ReferralReward, ReferralRewardSchema } from './schemas/referral-reward.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReferralCode.name, schema: ReferralCodeSchema },
      { name: Referral.name, schema: ReferralSchema },
      { name: ReferralReward.name, schema: ReferralRewardSchema },
    ]),
    UsersModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
