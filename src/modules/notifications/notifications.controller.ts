import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';
import { RespondNotificationDto } from './dto/respond-notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.listForUser(user.userId, query);
  }

  @Post('mark-read')
  markRead(@CurrentUser() user, @Body() dto: MarkNotificationsReadDto) {
    return this.notificationsService.markRead(user.userId, dto);
  }

  @Post('mark-all-read')
  markAll(@CurrentUser() user) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user) {
    return this.notificationsService.unreadCount(user.userId);
  }

  @Post(':id/respond')
  respond(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: RespondNotificationDto,
  ) {
    return this.notificationsService.respond(user.userId, id, dto);
  }
}
