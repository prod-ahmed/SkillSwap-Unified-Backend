import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type SessionDocument = HydratedDocument<Session>;

export enum SessionStatus {
  UPCOMING = 'upcoming',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
}

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  teacher: Types.ObjectId; // user who teaches the session

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  student: Types.ObjectId; // user who learns in the session

  @Prop({ type: [{ type: Types.ObjectId, ref: User.name }], default: [] })
  students: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: User.name }], default: [] })
  participants: Types.ObjectId[];

  @Prop({ required: true })
  skill: string; // e.g. "Guitare", "Anglais"

  @Prop({ required: true })
  title: string; // e.g. "Cours de guitare - Accords de base"

  @Prop({ required: true })
  date: Date; // full date and time

  @Prop({ required: true })
  duration: number; // in minutes (ex: 60, 90)

  @Prop({
    type: String,
    enum: SessionStatus,
    default: SessionStatus.UPCOMING,
  })
  status: SessionStatus;

  @Prop()
  meetingLink?: string; // optional (e.g. Zoom, Google Meet)

  @Prop()
  notes?: string; // optional notes for teacher/student

  @Prop({ type: Boolean, default: false })
  feedbackGiven: boolean; // track if both users gave feedback

  @Prop({ type: Number, default: 0 })
  teacherRating: number; // average rating given by student to teacher

  @Prop({ type: Number, default: 0 })
  studentRating: number; // average rating given by teacher to student
}

export const SessionSchema = SchemaFactory.createForClass(Session);
