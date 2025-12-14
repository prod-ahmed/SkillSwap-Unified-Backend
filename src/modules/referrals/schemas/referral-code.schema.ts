import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ReferralCode extends Document {
  @Prop({ type: String, unique: true, required: true, index: true })
  code: string; // 8-char base62

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  inviterId: Types.ObjectId;

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({ type: Number, default: 0 })
  usageLimit: number; // 0 = unlimited

  @Prop({ type: Number, default: 0 })
  remainingUses: number;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: String, default: null })
  campaign?: string;
}

export const ReferralCodeSchema = SchemaFactory.createForClass(ReferralCode);
