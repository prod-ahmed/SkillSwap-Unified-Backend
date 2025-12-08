import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type ProgressGoalDocument = HydratedDocument<ProgressGoal>;

export type GoalPeriod = 'week' | 'month';
export type GoalStatus = 'active' | 'completed' | 'archived';

@Schema({ timestamps: true })
export class ProgressGoal {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ type: Number, required: true })
  targetHours: number;

  @Prop({ type: Number, default: 0 })
  currentHours: number;

  @Prop({ type: String, enum: ['week', 'month'], default: 'week' })
  period: GoalPeriod;

  @Prop({ type: String, enum: ['active', 'completed', 'archived'], default: 'active' })
  status: GoalStatus;

  @Prop({ type: Date, required: false })
  dueDate?: Date;
}

export const ProgressGoalSchema = SchemaFactory.createForClass(ProgressGoal);

ProgressGoalSchema.index({ user: 1, period: 1, status: 1 });
