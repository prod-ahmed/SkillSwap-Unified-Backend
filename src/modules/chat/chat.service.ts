import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MessageThread, MessageThreadDocument } from './schemas/message-thread.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateThreadDto } from './dto/create-thread.dto';
import { ListThreadsQueryDto } from './dto/list-threads-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkThreadReadDto } from './dto/mark-thread-read.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-type.enum';
import { MessageType } from './message-type.enum';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(MessageThread.name)
    private readonly threadModel: Model<MessageThreadDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly chatGateway: ChatGateway,
  ) { }

  async listThreads(userId: string, query: ListThreadsQueryDto) {
    const requesterId = new Types.ObjectId(userId);
    const limit = query.limit ?? 20;
    const skip = query.skip ?? 0;

    const [threads, total] = await Promise.all([
      this.threadModel
        .find({ participants: requesterId })
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants', 'username email image badges')
        .lean(),
      this.threadModel.countDocuments({ participants: requesterId }),
    ]);

    const threadIds = threads.map((thread) => thread._id);
    let lastMessages: any[] = [];
    let unreadCounts: any[] = [];

    if (threadIds.length) {
      [lastMessages, unreadCounts] = await Promise.all([
        this.messageModel.aggregate([
          { $match: { thread: { $in: threadIds } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: '$thread',
              doc: { $first: '$$ROOT' },
            },
          },
        ]),
        this.messageModel.aggregate([
          {
            $match: {
              thread: { $in: threadIds },
              recipient: requesterId,
              read: false,
            },
          },
          {
            $group: {
              _id: '$thread',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      if (lastMessages.length > 0) {
        await this.messageModel.populate(lastMessages, { path: 'doc.replyTo' });
      }
    }

    const lastMessageMap = new Map<string, any>();
    lastMessages.forEach((entry) => {
      lastMessageMap.set(entry._id.toString(), entry.doc);
    });

    const unreadMap = new Map<string, number>();
    unreadCounts.forEach((entry) => {
      unreadMap.set(entry._id.toString(), entry.count);
    });

    const items = threads.map((thread) => {
      const threadId = thread._id.toString();
      const lastMessage = lastMessageMap.get(threadId);
      return {
        id: threadId,
        participants: thread.participants,
        sessionId: thread.session ? thread.session.toString() : null,
        topic: thread.topic ?? null,
        metadata: thread.metadata ?? {},
        lastMessageAt: thread.lastMessageAt,
        lastMessage,
        unreadCount: unreadMap.get(threadId) ?? 0,
      };
    });

    return {
      items,
      total,
      limit,
      skip,
      hasNextPage: skip + items.length < total,
    };
  }

  async createThread(userId: string, dto: CreateThreadDto) {
    const requesterId = new Types.ObjectId(userId);
    const participant = await this.resolveParticipant(dto);

    if (participant._id.equals(requesterId)) {
      throw new BadRequestException('Impossible de démarrer une discussion avec vous-même');
    }

    const participantId = participant._id;

    const baseFilter = {
      participants: { $all: [requesterId, participantId], $size: 2 },
    };

    const sessionFilter = dto.sessionId
      ? { ...baseFilter, session: new Types.ObjectId(dto.sessionId) }
      : baseFilter;

    let existing = await this.threadModel.findOne(sessionFilter);

    if (!existing) {
      existing = await this.threadModel.findOne(baseFilter);
    }

    if (existing) {
      await existing.populate('participants', 'username email image badges');
      return existing;
    }

    const thread = new this.threadModel({
      participants: [requesterId, participantId],
      createdBy: requesterId,
      session: dto.sessionId ? new Types.ObjectId(dto.sessionId) : undefined,
      topic: dto.topic ?? null,
      metadata: dto.topic ? { topic: dto.topic } : {},
      lastMessageAt: new Date(),
    });

    await thread.save();
    await thread.populate('participants', 'username email image badges');
    return thread;
  }

  private async resolveParticipant(dto: CreateThreadDto) {
    if (dto.participantId) {
      const participant = await this.userModel.findById(dto.participantId);
      if (!participant) {
        throw new NotFoundException('Participant introuvable');
      }
      return participant;
    }

    if (dto.participantEmail) {
      const normalizedEmail = dto.participantEmail.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new BadRequestException('Adresse e-mail du destinataire requise');
      }
      const participant = await this.userModel.findOne({ email: normalizedEmail });
      if (!participant) {
        throw new NotFoundException('Participant introuvable');
      }
      return participant;
    }

    throw new BadRequestException('Destinataire manquant');
  }

  async listMessages(userId: string, threadId: string, query: ListMessagesQueryDto) {
    await this.ensureParticipant(threadId, userId);
    const limit = query.limit ?? 30;
    const filter: Record<string, any> = { thread: new Types.ObjectId(threadId) };
    if (query.before) {
      filter.createdAt = { $lt: new Date(query.before) };
    }

    const messages = await this.messageModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('replyTo')
      .lean();

    return {
      threadId,
      items: messages.reverse(),
      hasMore: messages.length === limit,
    };
  }

  async sendMessage(userId: string, threadId: string, dto: SendMessageDto) {
    const thread = await this.ensureParticipant(threadId, userId);
    const senderId = new Types.ObjectId(userId);
    const recipientId = this.pickRecipient(thread, senderId);

    const message = await this.messageModel.create({
      thread: thread._id,
      sender: senderId,
      recipient: recipientId,
      type: dto.type ?? MessageType.Text,
      content: dto.content,
      attachmentUrl: dto.attachmentUrl,
      metadata: dto.metadata ?? {},
      replyTo: dto.replyToId ? new Types.ObjectId(dto.replyToId) : undefined,
    });

    // Populate replyTo if exists
    if (dto.replyToId) {
      await message.populate('replyTo');
    }

    const lastActivity = new Date();
    await this.threadModel.findByIdAndUpdate(thread._id, {
      lastMessageAt: lastActivity,
      lastMessage: message,
      metadata: {
        ...(thread.metadata ?? {}),
        lastPreview: dto.content.slice(0, 140),
      },
    });

    await this.notificationsService.createNotification({
      userId: recipientId,
      type: NotificationType.Message,
      title: 'Nouveau message',
      message: dto.content.length > 120 ? `${dto.content.slice(0, 120)}…` : dto.content,
      payload: {
        threadId: thread._id.toString(),
        senderId: userId,
      },
    });

    this.chatGateway.broadcastMessage(thread._id.toString(), message);

    return message;
  }

  async reactToMessage(userId: string, messageId: string, reaction: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message introuvable');

    // Ensure user is participant
    await this.ensureParticipant(message.thread.toString(), userId);

    const reactions = message.reactions || {};
    const userIds = reactions[reaction] || [];

    if (userIds.includes(userId)) {
      // Toggle off
      reactions[reaction] = userIds.filter((id) => id !== userId);
      if (reactions[reaction].length === 0) {
        delete reactions[reaction];
      }
    } else {
      // Toggle on
      reactions[reaction] = [...userIds, userId];
    }

    // Mongoose requires marking mixed types as modified
    message.reactions = reactions;
    message.markModified('reactions');
    await message.save();

    this.chatGateway.broadcastReaction(message.thread.toString(), {
      messageId,
      reactions: message.reactions,
    });

    return message;
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.messageModel.findById(messageId);
    if (!message) throw new NotFoundException('Message introuvable');

    if (message.sender.toString() !== userId) {
      throw new ForbiddenException('Vous ne pouvez supprimer que vos propres messages');
    }

    message.isDeleted = true;
    message.content = 'Ce message a été supprimé';
    message.attachmentUrl = undefined;
    await message.save();

    this.chatGateway.broadcastDeletion(message.thread.toString(), messageId);

    return message;
  }

  async markRead(userId: string, threadId: string, dto: MarkThreadReadDto) {
    await this.ensureParticipant(threadId, userId);
    const recipientId = new Types.ObjectId(userId);

    const filter: Record<string, any> = {
      thread: new Types.ObjectId(threadId),
      recipient: recipientId,
      read: false,
    };

    if (dto.ids?.length) {
      filter._id = { $in: dto.ids.map((id) => new Types.ObjectId(id)) };
    }

    const updateResult = await this.messageModel.updateMany(filter, {
      $set: { read: true, readAt: new Date() },
    });

    return { updated: updateResult.modifiedCount };
  }

  private async ensureParticipant(threadId: string, userId: string) {
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Conversation introuvable');
    }
    const requesterId = new Types.ObjectId(userId);
    const isParticipant = thread.participants.some((participant) => participant.equals(requesterId));
    if (!isParticipant) {
      throw new ForbiddenException('Accès refusé pour cette conversation');
    }
    return thread;
  }

  private pickRecipient(thread: MessageThreadDocument, senderId: Types.ObjectId) {
    const recipient = thread.participants.find((participant) => !participant.equals(senderId));
    if (!recipient) {
      throw new BadRequestException('Impossible de déterminer le destinataire');
    }
    return recipient;
  }
}
