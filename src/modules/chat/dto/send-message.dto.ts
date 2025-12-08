import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { MessageType } from '../message-type.enum';

export class SendMessageDto {
  @IsString()
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  replyToId?: string;
}
