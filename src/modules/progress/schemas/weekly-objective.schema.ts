import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type WeeklyObjectiveDocument = HydratedDocument<WeeklyObjective>;

export type ObjectiveStatus = 'IN_PROGRESS' | 'COMPLETED';

@Schema({ _id: false })
export class DailyTask {
  @Prop({ required: true })
  day: string; // "Day 1", "Day 2", etc.

  @Prop({ required: true })
  task: string;

  @Prop({ default: false })
  isCompleted: boolean;
}

export const DailyTaskSchema = SchemaFactory.createForClass(DailyTask);

@Schema({ timestamps: true })
export class WeeklyObjective {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ type: Number, required: true })
  targetHours: number;

  @Prop({ type: Number, default: 0 })
  completedHours: number;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: String, enum: ['IN_PROGRESS', 'COMPLETED'], default: 'IN_PROGRESS' })
  status: ObjectiveStatus;

  @Prop({ type: [DailyTaskSchema], default: [] })
  dailyTasks: DailyTask[];
}

export const WeeklyObjectiveSchema = SchemaFactory.createForClass(WeeklyObjective);

WeeklyObjectiveSchema.index({ user: 1, status: 1 });
WeeklyObjectiveSchema.index({ user: 1, startDate: -1 });
