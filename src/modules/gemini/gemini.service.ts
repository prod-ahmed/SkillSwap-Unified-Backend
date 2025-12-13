import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Replicate from 'replicate';

@Injectable()
export class GeminiService {
  private model;
  private replicate: Replicate;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set. Please configure it in .env');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
    });

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      this.replicate = new Replicate({
        auth: replicateToken,
      });
    }
  }

  async generateText(prompt: string): Promise<string> {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const result = await this.model.generateContent(prompt);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return result.response.text();
      } catch (error) {
        lastError = error;
        // Check if it's a 429 error
        if (error.message && error.message.includes('429')) {
          console.warn(`Gemini API rate limit hit (attempt ${attempt}/${maxRetries}). Retrying in 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
          continue;
        }
        // If it's not a 429, throw immediately
        console.error('Gemini generateText error:', error);
        throw new Error('Gemini failed: ' + (error.message || error));
      }
    }
    
    console.error('Gemini generateText failed after retries:', lastError);
    throw new Error('Gemini failed after retries: ' + (lastError.message || lastError));
  }

  async generateImage(prompt: string): Promise<string> {
    try {
      // 1. Enhance prompt with Gemini
      const enhancedPrompt = await this.generateText(
        `Create a detailed, vivid image generation prompt for a marketing banner based on this description: "${prompt}". The prompt should describe style, lighting, and mood. Output ONLY the prompt text.`,
      );

      // 2. Use Replicate if available, otherwise fallback or throw
      if (!this.replicate) {
         throw new Error('REPLICATE_API_TOKEN is not configured');
      }

      console.log('Generating image with Replicate for prompt:', enhancedPrompt);
      
      const output = await this.replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: enhancedPrompt,
            aspect_ratio: "16:9",
            output_format: "jpg"
          }
        }
      );

      // Replicate returns an array of output items (usually URLs or streams)
      if (Array.isArray(output) && output.length > 0) {
          return String(output[0]);
      }
      
      return String(output);
    } catch (error) {
      console.error('Image generation failed:', error);
      throw new Error('Failed to generate image: ' + (error.message || error));
    }
  }
}

