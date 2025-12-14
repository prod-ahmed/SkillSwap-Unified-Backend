import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import { ListThreadsQueryDto } from './dto/list-threads-query.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkThreadReadDto } from './dto/mark-thread-read.dto';
import { chatFileUpload } from './chat.upload';
import { MessageType } from './message-type.enum';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Get('threads')
  listThreads(@CurrentUser() user, @Query() query: ListThreadsQueryDto) {
    return this.chatService.listThreads(user.userId, query);
  }

  @Post('threads')
  createThread(@CurrentUser() user, @Body() dto: CreateThreadDto) {
    return this.chatService.createThread(user.userId, dto);
  }

  @Get('threads/:threadId/messages')
  listMessages(
    @CurrentUser() user,
    @Param('threadId') threadId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.chatService.listMessages(user.userId, threadId, query);
  }

  @Post('threads/:threadId/messages')
  sendMessage(
    @CurrentUser() user,
    @Param('threadId') threadId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.userId, threadId, dto);
  }

  @Post('threads/:threadId/read')
  markRead(
    @CurrentUser() user,
    @Param('threadId') threadId: string,
    @Body() dto: MarkThreadReadDto,
  ) {
    return this.chatService.markRead(user.userId, threadId, dto);
  }

  @Post('messages/:id/react')
  async react(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body('reaction') reaction: string,
  ) {
    return this.chatService.reactToMessage(user.userId, id, reaction);
  }

  @Delete('messages/:id')
  async deleteMessage(@CurrentUser() user, @Param('id') id: string) {
    return this.chatService.deleteMessage(user.userId, id);
  }

  @Post('threads/:threadId/upload')
  @UseInterceptors(FileInterceptor('file', chatFileUpload))
  async uploadAttachment(
    @CurrentUser() user,
    @Param('threadId') threadId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('content') content?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Construct the attachment URL
    const attachmentUrl = `/uploads/chat/${file.filename}`;

    // Send the message with attachment
    return this.chatService.sendMessage(user.userId, threadId, {
      content: content || file.originalname,
      type: MessageType.Attachment,
      attachmentUrl,
    });
  }
}
