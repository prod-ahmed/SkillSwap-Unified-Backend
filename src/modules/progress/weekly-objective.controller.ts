import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WeeklyObjectiveService } from './weekly-objective.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { CreateWeeklyObjectiveDto } from './dto/create-weekly-objective.dto';
import { UpdateWeeklyObjectiveDto } from './dto/update-weekly-objective.dto';

@Controller('weekly-objectives')
@UseGuards(JwtAuthGuard)
export class WeeklyObjectiveController {
  constructor(private readonly weeklyObjectiveService: WeeklyObjectiveService) {}

  @Get('current')
  getCurrent(@CurrentUser() user) {
    return this.weeklyObjectiveService.getCurrent(user.userId);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.weeklyObjectiveService.getHistory(
      user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Post()
  create(@CurrentUser() user, @Body() dto: CreateWeeklyObjectiveDto) {
    return this.weeklyObjectiveService.create(user.userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user,
    @Param('id') objectiveId: string,
    @Body() dto: UpdateWeeklyObjectiveDto,
  ) {
    return this.weeklyObjectiveService.update(user.userId, objectiveId, dto);
  }

  @Patch(':id/complete')
  complete(@CurrentUser() user, @Param('id') objectiveId: string) {
    return this.weeklyObjectiveService.complete(user.userId, objectiveId);
  }

  @Delete(':id')
  delete(@CurrentUser() user, @Param('id') objectiveId: string) {
    return this.weeklyObjectiveService.delete(user.userId, objectiveId);
  }
}
