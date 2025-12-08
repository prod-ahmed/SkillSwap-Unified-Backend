import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { NotificationType } from './notification-type.enum';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { MarkNotificationsReadDto } from './dto/mark-read.dto';
import { RespondNotificationDto } from './dto/respond-notification.dto';
import { SessionsService } from '../sessions/sessions.service';
import { UpdateSessionDto } from '../sessions/dto/update-session.dto';

export interface CreateNotificationInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, any>;
  sessionId?: string | Types.ObjectId;
  meetingUrl?: string;
  actionable?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @Inject(forwardRef(() => SessionsService))
    private readonly sessionsService: SessionsService,
  ) { }

  async createNotification(input: CreateNotificationInput) {
    const doc = new this.notificationModel({
      user: new Types.ObjectId(input.userId),
      type: input.type,
      title: input.title,
      message: input.message,
      payload: input.payload || {},
      session: input.sessionId ? new Types.ObjectId(input.sessionId) : undefined,
      meetingUrl: input.meetingUrl,
      actionable: input.actionable ?? false,
    });
    return doc.save();
  }

  async sendNotification(input: CreateNotificationInput) {
    return this.createNotification(input);
  }

  async listForUser(userId: string, query: ListNotificationsQueryDto) {
    const filter: FilterQuery<Notification> = { user: new Types.ObjectId(userId) };
    const status = query.status ?? 'all';
    if (status === 'unread') {
      filter.read = false;
    } else if (status === 'read') {
      filter.read = true;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.notificationModel.countDocuments(filter),
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    return {
      items,
      page,
      limit,
      total,
      hasNextPage: page * limit < total,
    };
  }

  async markRead(userId: string, dto: MarkNotificationsReadDto) {
    if (!dto.ids?.length) {
      throw new BadRequestException('No notification ids provided');
    }

    const readAt = new Date();
    await this.notificationModel.updateMany(
      {
        user: new Types.ObjectId(userId),
        _id: { $in: dto.ids.map((id) => new Types.ObjectId(id)) },
      },
      { $set: { read: true, readAt } },
    );

    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    const readAt = new Date();
    await this.notificationModel.updateMany(
      { user: new Types.ObjectId(userId), read: false },
      { $set: { read: true, readAt } },
    );
    return { unread: 0 };
  }

  async unreadCount(userId: string) {
    const unread = await this.notificationModel.countDocuments({
      user: new Types.ObjectId(userId),
      read: false,
    });
    return { unread };
  }

  async respond(userId: string, notificationId: string, dto: RespondNotificationDto) {
    const notification = await this.notificationModel.findOne({
      _id: notificationId,
      user: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (!notification.actionable) {
      throw new BadRequestException('Notification cannot be responded to');
    }
    if (notification.responded) {
      throw new BadRequestException('Notification already responded');
    }

    if (notification.type === NotificationType.RescheduleRequest && notification.session) {
      await this.handleRescheduleResponse(notification, dto.accepted);
    }

    notification.responded = true;
    notification.respondedAt = new Date();
    notification.actionResult = dto.accepted ? 'accepted' : 'declined';
    notification.payload = {
      ...notification.payload,
      responseMessage: dto.message ?? null,
      responded: true,
    };
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return notification;
  }

  private async handleRescheduleResponse(notification: NotificationDocument, accepted: boolean) {
    if (!accepted) {
      return;
    }

    const payload = notification.payload || {};
    const sessionId = notification.session?.toString();
    if (!sessionId) {
      return;
    }

    const updateDto: UpdateSessionDto = {} as UpdateSessionDto;
    const nextDate = this.combineDateAndTime(payload.newDate, payload.newTime);
    if (nextDate) {
      updateDto.date = nextDate;
    }
    if (payload.newStatus) {
      updateDto.status = payload.newStatus;
    }
    if (payload.meetingLink) {
      updateDto.meetingLink = payload.meetingLink;
    }

    // Only call service if there is anything to update
    if (Object.keys(updateDto).length > 0) {
      await this.sessionsService.update(sessionId, updateDto);
    }
  }

  private combineDateAndTime(dateValue?: string, timeValue?: string) {
    if (!dateValue) {
      return undefined;
    }

    const date = new Date(dateValue);
    if (timeValue) {
      const [hours, minutes] = timeValue.split(':').map((part) => Number.parseInt(part, 10));
      if (!Number.isNaN(hours)) {
        date.setHours(hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
      }
    }

    return date.toISOString();
  }
}
