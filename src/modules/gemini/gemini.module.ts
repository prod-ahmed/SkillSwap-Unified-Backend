import { Module } from '@nestjs/common';
import { AIController } from './gemini.controller';
import { CloudflareAIModule } from '../cloudflare-ai/cloudflare-ai.module';

@Module({
  imports: [CloudflareAIModule],
  controllers: [AIController],
})
export class AIModule { }
