import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly accountId: string | undefined;
  private readonly apiToken: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    // Use Cloudflare AI
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    this.apiToken = process.env.CLOUDFLARE_WORKERS_AI_API_KEY;

    if (!this.accountId || !this.apiToken) {
      this.logger.warn('Cloudflare AI credentials not configured');
    }

    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run`;
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.accountId || !this.apiToken) {
      throw new Error('Cloudflare AI not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_WORKERS_AI_API_KEY in .env');
    }

    const modelUrl = `${this.baseUrl}/@cf/meta/llama-3.1-8b-instruct`;

    try {
      this.logger.log('Calling Cloudflare AI with Llama 3.1');

      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare AI error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(`Cloudflare AI failed: ${JSON.stringify(data.errors)}`);
      }

      const text = data.result?.response || '';
      this.logger.log(`Generated ${text.length} characters`);
      return text;
    } catch (error) {
      this.logger.error('Cloudflare AI error:', error);
      throw new Error('AI generation failed: ' + (error.message || error));
    }
  }

  async generateImage(prompt: string): Promise<string> {
    if (!this.accountId || !this.apiToken) {
      throw new Error('Cloudflare AI not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_WORKERS_AI_API_KEY in .env');
    }

    try {
      // Use Cloudflare's Stable Diffusion XL Lightning model
      const modelUrl = `${this.baseUrl}/@cf/bytedance/stable-diffusion-xl-lightning`;

      this.logger.log('Generating image with Cloudflare Stable Diffusion XL Lightning');

      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          num_steps: 4,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare AI image generation error: ${response.status} - ${errorText}`);
      }

      // Cloudflare returns binary image data
      const imageBuffer = await response.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');

      // Return as data URL
      const dataUrl = `data:image/png;base64,${base64Image}`;

      this.logger.log('Image generated successfully via Cloudflare AI');
      return dataUrl;

    } catch (error) {
      this.logger.error('Cloudflare AI image generation failed:', error);
      throw new Error('Failed to generate image: ' + (error.message || error));
    }
  }
}
