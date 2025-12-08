import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @IsIn(['all', 'unread', 'read'])
  status: 'all' | 'unread' | 'read' = 'all';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
