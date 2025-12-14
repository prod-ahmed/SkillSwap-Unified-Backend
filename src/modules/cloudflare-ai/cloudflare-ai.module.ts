import { Module } from '@nestjs/common';
import { CloudflareAIService } from './cloudflare-ai.service';

@Module({
  providers: [CloudflareAIService],
  exports: [CloudflareAIService],
})
export class CloudflareAIModule {}
