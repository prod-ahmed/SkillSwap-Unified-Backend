import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    controllers: [ModerationController],
    providers: [ModerationService],
    exports: [ModerationService],
})
export class ModerationModule { }
