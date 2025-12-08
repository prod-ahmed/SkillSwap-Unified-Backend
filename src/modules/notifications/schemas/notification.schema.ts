import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { NotificationType } from '../notification-type.enum';
import { User } from '../../users/schemas/user.schema';
import { Session } from '../../sessions/entities/session.entity';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  payload: Record<string, any>;

  @Prop({ type: Types.ObjectId, ref: Session.name })
  session?: Types.ObjectId;

  @Prop()
  meetingUrl?: string;

  @Prop({ default: false })
  actionable: boolean;

  @Prop({ default: false })
  responded: boolean;

  @Prop({ default: false })
  read: boolean;

  @Prop()
  readAt?: Date;

  @Prop({ enum: ['accepted', 'declined', 'acknowledged'], required: false })
  actionResult?: 'accepted' | 'declined' | 'acknowledged';

  @Prop()
  respondedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
