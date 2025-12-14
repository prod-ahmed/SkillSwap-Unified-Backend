import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LessonPlanController } from './lesson-plan.controller';
import { LessonPlanService } from './lesson-plan.service';
import { LessonPlan, LessonPlanSchema } from './schemas/lesson-plan.schema';
import { Session, SessionSchema } from '../sessions/entities/session.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SessionsModule } from '../sessions/sessions.module';
import { CloudflareAIModule } from '../cloudflare-ai/cloudflare-ai.module';

/**
 * Lesson Plan Module
 * 
 * This module provides:
 * - Lesson plan generation using Cloudflare Workers AI
 * - Lesson plan storage and retrieval
 * - Progress tracking for checklist items
 * 
 * Dependencies:
 * - NotificationsModule: For sending notifications when plans are generated
 * - SessionsModule: For accessing session data
 * - CloudflareAIModule: For AI-powered lesson plan generation
 */
@Module({
  imports: [
    // Register LessonPlan schema in Mongoose
    MongooseModule.forFeature([
      { name: LessonPlan.name, schema: LessonPlanSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    // Import NotificationsModule for sending notifications
    NotificationsModule,
    // Import SessionsModule for accessing session service (use forwardRef to avoid circular dependency)
    forwardRef(() => SessionsModule),
    CloudflareAIModule,
  ],
  controllers: [LessonPlanController],
  providers: [LessonPlanService],
  exports: [LessonPlanService], // Export service so it can be used in other modules
})
export class LessonPlanModule {}
