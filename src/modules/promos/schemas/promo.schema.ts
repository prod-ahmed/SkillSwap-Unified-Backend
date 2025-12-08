import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PromoDocument = Promo & Document;

@Schema({ timestamps: true })
export class Promo {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId; // Foreign key reference to User

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  imageUrl?: string;

  @Prop({ required: true })
  discountPercent: number; // e.g. 20 (%)

  @Prop()
  promoCode?: string;

  @Prop({ required: true })
  validFrom: Date;

  @Prop({ required: true })
  validTo: Date;
}

export const PromoSchema = SchemaFactory.createForClass(Promo);
