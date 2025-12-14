import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CloudflareAIResponse {
  result: {
    response?: string;
    text?: string;
  };
  success: boolean;
  errors: any[];
  messages: any[];
}

@Injectable()
export class CloudflareAIService {
  private readonly logger = new Logger(CloudflareAIService.name);
  private readonly accountId: string | undefined;
  private readonly apiToken: string | undefined;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.accountId = this.configService.get<string>('CLOUDFLARE_ACCOUNT_ID');
    this.apiToken = this.configService.get<string>('CLOUDFLARE_WORKERS_AI_API_KEY');
    
    if (!this.accountId || !this.apiToken) {
      this.logger.warn('Cloudflare AI credentials not configured');
    }
    
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run`;
  }

  async generateText(
    prompt: string,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {},
  ): Promise<string> {
    if (!this.accountId || !this.apiToken) {
      throw new Error('Cloudflare AI not configured');
    }

    const { systemPrompt, maxTokens = 2048, temperature = 0.7 } = options;

    const messages: any[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const modelUrl = `${this.baseUrl}/@cf/openchat/openchat-3.5-0106`;

    try {
      this.logger.log(`Calling Cloudflare AI`);
      
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages, max_tokens: maxTokens, temperature, stream: false }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare AI error: ${response.status} - ${errorText}`);
      }

      const data: CloudflareAIResponse = await response.json();

      if (!data.success) {
        throw new Error(`Cloudflare AI failed: ${JSON.stringify(data.errors)}`);
      }

      const text = data.result?.response || data.result?.text || '';
      this.logger.log(`Generated ${text.length} characters`);
      return text;
      
    } catch (error) {
      this.logger.error('Cloudflare AI error:', error);
      throw error;
    }
  }
}
