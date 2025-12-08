import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ReferralReward extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Referral' })
  referralId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId; // receiver of the reward

  @Prop({ type: String })
  rewardType: string; // 'credit' | 'promo' | 'feature'

  @Prop({ type: Number, default: 0 })
  amount?: number;

  @Prop({ type: String, enum: ['applied','failed','reverted'], default: 'applied' })
  status: string;

  @Prop({ type: Object, default: {} })
  metadata?: any;
}

export const ReferralRewardSchema = SchemaFactory.createForClass(ReferralReward);
ReferralRewardSchema.index({ referralId: 1 });
ReferralRewardSchema.index({ userId: 1 });
