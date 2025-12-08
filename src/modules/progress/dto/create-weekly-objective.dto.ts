import { IsString, IsNumber, IsDateString, IsArray, ValidateNested, IsOptional, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class DailyTaskDto {
  @IsString()
  day: string;

  @IsString()
  task: string;
}

export class CreateWeeklyObjectiveDto {
  @IsString()
  title: string;

  @IsNumber()
  @Min(1)
  @Max(168) // Max hours in a week
  targetHours: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyTaskDto)
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  dailyTasks: DailyTaskDto[];
}
