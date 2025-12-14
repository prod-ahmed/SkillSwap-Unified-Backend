import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReferralStatus = 'pending' | 'completed' | 'rejected' | 'on_hold';

@Schema({ timestamps: true })
export class Referral extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ReferralCode', required: true, index: true })
  codeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  inviterId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true, unique: true })
  inviteeId: Types.ObjectId; // unique ensures single referral per invitee

  @Prop({ type: String, default: null })
  inviteeEmail?: string;

  @Prop({ type: String, enum: ['pending','completed','rejected','on_hold'], default: 'pending' })
  status: ReferralStatus;

  @Prop({ type: Boolean, default: false })
  rewardApplied: boolean;

  @Prop({ type: Types.ObjectId, ref: 'ReferralReward', default: null })
  rewardRecordId?: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  source?: {
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  };
}

export const ReferralSchema = SchemaFactory.createForClass(Referral);
