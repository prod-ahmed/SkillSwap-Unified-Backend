// sessions.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CurrentUser } from 'src/modules/auth/common/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/auth/jwt-auth.guard';
import { SessionStatus } from './entities/session.entity';
import { RequestRescheduleDto } from './dto/request-reschedule.dto';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  createSession(@Body() dto: CreateSessionDto, @CurrentUser() user) {
    return this.sessionsService.create(dto, user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMySessions(@CurrentUser() user) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.sessionsService.getUserSessions(user.userId);
  }

  @Get('availability')
  @UseGuards(JwtAuthGuard)
  checkAvailability(
    @Query('emails') emails: string,
    @Query('date') date: string,
    @Query('duration') duration: string,
  ) {
    const emailList = emails ? emails.split(',').map(e => e.trim()) : [];
    const parsedDate = new Date(date);
    const parsedDuration = parseInt(duration, 10) || 60;
    return this.sessionsService.checkAvailability(emailList, parsedDate, parsedDuration);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(@Param('id') id: string, @Body('status') status: SessionStatus) {
    return this.sessionsService.updateStatus(id, status);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessionsService.update(id, dto);
  }

  @Get()
  findAll() {
    return this.sessionsService.findAll();
  }

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  getRecommendations(@CurrentUser() user) {
    return this.sessionsService.getRecommendations(user.userId);
  }

  @Post(':id/reschedule-request')
  @UseGuards(JwtAuthGuard)
  requestReschedule(
    @Param('id') id: string,
    @Body() dto: RequestRescheduleDto,
    @CurrentUser() user,
  ) {
    return this.sessionsService.requestReschedule(id, user.userId, dto);
  }
}
