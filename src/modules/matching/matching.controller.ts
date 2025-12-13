import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MatchingService } from './matching.service';

@UseGuards(JwtAuthGuard)
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('recommendations')
  async recommendations(
    @Req() req,
    @Query('city') city?: string,
    @Query('skill') skill?: string,
    @Query('limit') limit = 20,
  ) {
    return this.matchingService.recommendations(req.user.userId, { city, skill, limit: Number(limit) });
  }
}
