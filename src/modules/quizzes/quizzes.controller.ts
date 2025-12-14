import { Controller, Get, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { QuizzesService } from './quizzes.service';
import { CreateQuizResultDto } from './dto/create-quiz-result.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Post('results')
  async saveResult(@Body() dto: CreateQuizResultDto, @Request() req) {
    return this.quizzesService.saveResult(req.user.userId, dto);
  }

  @Get('results')
  async getResults(@Request() req) {
    return this.quizzesService.getUserResults(req.user.userId);
  }

  @Get('results/:skill')
  async getSkillProgress(@Param('skill') skill: string, @Request() req) {
    return this.quizzesService.getSkillProgress(req.user.userId, skill);
  }
}
