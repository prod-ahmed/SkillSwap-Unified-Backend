import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuizResultDocument = QuizResult & Document;

@Schema({ timestamps: true })
export class QuizResult {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  skill: string;

  @Prop({ required: true, min: 1, max: 5 })
  level: number;

  @Prop({ required: true, min: 0 })
  score: number;

  @Prop({ required: true, min: 1 })
  totalQuestions: number;

  @Prop({ required: true })
  percentage: number;

  @Prop({
    type: [{
      question: String,
      userAnswer: String,
      correct: Boolean
    }]
  })
  answers: {
    question: string;
    userAnswer: string;
    correct: boolean;
  }[];

  @Prop({ default: Date.now })
  completedAt: Date;
}

export const QuizResultSchema = SchemaFactory.createForClass(QuizResult);

// Indexes for performance
QuizResultSchema.index({ userId: 1, skill: 1 });
QuizResultSchema.index({ userId: 1, completedAt: -1 });
