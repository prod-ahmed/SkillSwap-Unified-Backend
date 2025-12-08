import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Controller('progress')
@UseGuards(JwtAuthGuard)
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user) {
    return this.progressService.getDashboard(user.userId);
  }

  @Post('goals')
  createGoal(@CurrentUser() user, @Body() dto: CreateGoalDto) {
    return this.progressService.createGoal(user.userId, dto);
  }

  @Patch('goals/:id')
  updateGoal(
    @CurrentUser() user,
    @Param('id') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.progressService.updateGoal(user.userId, goalId, dto);
  }

  @Delete('goals/:id')
  deleteGoal(@CurrentUser() user, @Param('id') goalId: string) {
    return this.progressService.deleteGoal(user.userId, goalId);
  }
}
