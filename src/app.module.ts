import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

// Base Modules
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AnnoncesModule } from './modules/annonces/annonces.module';
import { PromosModule } from './modules/promos/promos.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProgressModule } from './modules/progress/progress.module';
import { ChatModule } from './modules/chat/chat.module';
import { CallingModule } from './modules/calling/calling.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { MatchingModule } from './modules/matching/matching.module';

// Secondary Modules (New)
import { GeminiModule } from './modules/gemini/gemini.module';
import { GoogleModule } from './modules/google/google.module';
import { LessonPlanModule } from './modules/lesson-plan/lesson-plan.module';

@Module({
    imports: [
        // Global Config
        ConfigModule.forRoot({
            isGlobal: true,
        }),

        // Database
        MongooseModule.forRoot(
            process.env.MONGO_URI || 'mongodb://localhost:27017/skillswaptn',
        ),

        // Feature Modules
        UsersModule,
        AuthModule,
        MailModule,
        SessionsModule,
        AnnoncesModule,
        PromosModule,
        ReferralsModule,
        NotificationsModule,
        ProgressModule,
        ChatModule,
        CallingModule,
        LocationsModule,
        ModerationModule,
        MatchingModule,

        // New Features
        GeminiModule,
        GoogleModule,
        LessonPlanModule,
    ],
})
export class AppModule { }
