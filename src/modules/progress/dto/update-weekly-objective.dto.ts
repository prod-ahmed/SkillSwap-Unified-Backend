import { IsBoolean, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDailyTaskDto {
  @IsNumber()
  @Min(0)
  @Max(6)
  index: number;

  @IsBoolean()
  isCompleted: boolean;
}

export class UpdateWeeklyObjectiveDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDailyTaskDto)
  taskUpdates?: UpdateDailyTaskDto[];
}
