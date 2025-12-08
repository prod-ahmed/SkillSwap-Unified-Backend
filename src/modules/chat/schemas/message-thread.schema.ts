import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Session } from '../../sessions/entities/session.entity';

export type MessageThreadDocument = HydratedDocument<MessageThread>;

@Schema({ timestamps: true })
export class MessageThread {
  @Prop({ type: [{ type: Types.ObjectId, ref: User.name }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Session.name })
  session?: Types.ObjectId;

  @Prop({ type: String, default: null })
  topic?: string | null;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ type: Date, default: null })
  lastMessageAt: Date | null;
}

export const MessageThreadSchema = SchemaFactory.createForClass(MessageThread);

MessageThreadSchema.index({ participants: 1 });
MessageThreadSchema.index({ lastMessageAt: -1 });
MessageThreadSchema.index({ participants: 1, session: 1 });
