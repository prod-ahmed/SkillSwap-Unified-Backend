import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ModerationService, ModerationResult } from './moderation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { IsString, IsNotEmpty } from 'class-validator';

class CheckImageDto {
    @IsString()
    @IsNotEmpty()
    imageBase64: string;
}

@Controller('moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
    constructor(private readonly moderationService: ModerationService) { }

    @Post('check-image')
    async checkImage(@Body() dto: CheckImageDto): Promise<ModerationResult> {
        const result = await this.moderationService.checkImage(dto.imageBase64);
        return result;
    }
}
