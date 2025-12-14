import { IsString, IsNumber, IsArray, IsBoolean, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QuizAnswerDto {
  @IsString()
  question: string;

  @IsString()
  userAnswer: string;

  @IsBoolean()
  correct: boolean;
}

export class CreateQuizResultDto {
  @IsString()
  skill: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  level: number;

  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(1)
  totalQuestions: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  @IsOptional()
  answers?: QuizAnswerDto[];
}
