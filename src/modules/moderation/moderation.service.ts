import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData = require('form-data');
import fetch from 'node-fetch';

export interface ModerationResult {
    safe: boolean;
    categories?: string[];
    message?: string;
}

@Injectable()
export class ModerationService {
    private readonly logger = new Logger(ModerationService.name);
    private readonly sightengineApiUser: string | undefined;
    private readonly sightengineApiSecret: string | undefined;

    constructor(private configService: ConfigService) {
        this.sightengineApiUser = this.configService.get<string>('SIGHTENGINE_API_USER');
        this.sightengineApiSecret = this.configService.get<string>('SIGHTENGINE_API_SECRET');
    }

    async checkImage(imageBase64: string): Promise<ModerationResult> {
        if (!this.sightengineApiUser || !this.sightengineApiSecret) {
            this.logger.warn('Sightengine API credentials not configured, skipping moderation');
            return { safe: true, message: 'Moderation disabled' };
        }

        try {
            // Create form data with multipart/form-data encoding
            const form = new FormData();
            // Convert base64 to Buffer to send as a file
            const imageBuffer = Buffer.from(imageBase64, 'base64');
            form.append('media', imageBuffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
            form.append('models', 'nudity-2.0,wad,offensive,text-content');
            form.append('api_user', this.sightengineApiUser);
            form.append('api_secret', this.sightengineApiSecret);

            this.logger.log('Sending request to Sightengine API...');

            const response = await fetch('https://api.sightengine.com/1.0/check.json', {
                method: 'POST',
                body: form,
                headers: form.getHeaders(),
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error(`Sightengine API error: ${error}`);
                return { safe: true, message: 'Moderation service unavailable' };
            }

            const data: any = await response.json();

            this.logger.log(`Sightengine raw response: ${JSON.stringify(data)}`);

            // Check for various types of inappropriate content
            const categories: string[] = [];
            let isSafe = true;

            // Check nudity (threshold: 0.15 for stricter moderation)
            if (
                data.nudity?.sexual_activity > 0.15 ||
                data.nudity?.sexual_display > 0.15 ||
                data.nudity?.erotica > 0.15 ||
                data.nudity?.suggestive > 0.15 ||
                data.nudity?.sexual > 0.15 // Fallback if model uses this key
            ) {
                categories.push('nudity');
                isSafe = false;
                this.logger.log(`Nudity detected: sexual_activity=${data.nudity?.sexual_activity}, sexual_display=${data.nudity?.sexual_display}, erotica=${data.nudity?.erotica}, suggestive=${data.nudity?.suggestive}`);
            }

            // Check weapons, alcohol, drugs
            if (data.weapon > 0.5) {
                categories.push('weapons');
                isSafe = false;
                this.logger.log(`Weapon detected: ${data.weapon}`);
            }
            if (data.alcohol > 0.5) {
                categories.push('alcohol');
                isSafe = false;
                this.logger.log(`Alcohol detected: ${data.alcohol}`);
            }
            if (data.drugs > 0.5) {
                categories.push('drugs');
                isSafe = false;
                this.logger.log(`Drugs detected: ${data.drugs}`);
            }

            // Check offensive content
            if (data.offensive?.prob > 0.5) {
                categories.push('offensive');
                isSafe = false;
                this.logger.log(`Offensive content detected: ${data.offensive?.prob}`);
            }

            // Check text content for profanity - be more strict
            if (data.text) {
                this.logger.log(`Text detected in image: ${JSON.stringify(data.text)}`);

                // Check if any profanity was detected
                if (data.text.profanity && data.text.profanity.length > 0) {
                    categories.push('profanity');
                    isSafe = false;
                    this.logger.log(`Profanity detected: ${JSON.stringify(data.text.profanity)}`);
                }

                // Also check if text contains common profanity manually
                const detectedText = data.text.text || '';
                const profanityWords = ['fuck', 'shit', 'damn', 'bitch', 'ass', 'hell', 'crap'];
                const lowerText = detectedText.toLowerCase();

                for (const word of profanityWords) {
                    if (lowerText.includes(word)) {
                        categories.push('profanity');
                        isSafe = false;
                        this.logger.log(`Manual profanity check found: "${word}" in text: "${detectedText}"`);
                        break;
                    }
                }
            }

            this.logger.log(`Moderation result: safe=${isSafe}, categories=${categories.join(', ')}`);

            return {
                safe: isSafe,
                categories: categories.length > 0 ? categories : undefined,
            };
        } catch (error) {
            this.logger.error('Error during image moderation:', error);
            // Fail open - allow the image if there's an error
            return { safe: true, message: 'Moderation error' };
        }
    }
}
