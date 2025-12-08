import { Body, Controller, Post } from '@nestjs/common';
import { GeminiService } from './gemini.service';

/**
 * Basic controller exposing Gemini text generation endpoint.
 * Useful for testing prompts from clients (e.g., Android app).
 */
@Controller('ai')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('generate')
  async generate(@Body('prompt') prompt: string) {
    return {
      data: await this.geminiService.generateText(prompt),
    };
  }

  @Post('generate-image')
  async generateImage(@Body('prompt') prompt: string) {
    return {
      url: await this.geminiService.generateImage(prompt),
    };
  }
}

