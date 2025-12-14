import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AnnonceDocument = Annonce & Document;

@Schema({ timestamps: true, suppressReservedKeysWarning: true })
export class Annonce {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;            // 🔥 FK vers User

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop()
  imageUrl?: string;

  @Prop({ default: true })
  isNew: boolean;

  @Prop()
  city?: string;

  @Prop()
  category?: string;
}

export const AnnonceSchema = SchemaFactory.createForClass(Annonce);
