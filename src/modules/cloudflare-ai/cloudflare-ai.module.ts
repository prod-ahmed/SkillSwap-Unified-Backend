import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CloudflareAIService } from './cloudflare-ai.service';

@Module({
  imports: [ConfigModule],
  providers: [CloudflareAIService],
  exports: [CloudflareAIService],
})
export class CloudflareAIModule { }
