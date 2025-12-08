import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import type { GoalPeriod } from '../schemas/progress-goal.schema';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @Min(1)
  targetHours: number;

  @IsIn(['week', 'month'])
  period: GoalPeriod = 'week';

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
