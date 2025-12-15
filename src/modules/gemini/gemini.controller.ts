import { Body, Controller, Post } from '@nestjs/common';
import { CloudflareAIService } from '../cloudflare-ai/cloudflare-ai.service';

/**
 * AI controller using Cloudflare Workers AI for text and image generation.
 */
@Controller('ai')
export class AIController {
  constructor(private readonly cloudflareService: CloudflareAIService) { }

  @Post('generate')
  async generate(@Body('prompt') prompt: string) {
    return {
      data: await this.cloudflareService.generateText(prompt),
    };
  }

  @Post('chat')
  async chat(@Body('message') message: string) {
    const response = await this.cloudflareService.generateText(message);
    return { response };
  }
}
