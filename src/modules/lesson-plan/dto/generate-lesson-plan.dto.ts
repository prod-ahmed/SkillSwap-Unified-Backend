import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * DTO for generating a lesson plan
 * 
 * Used when a teacher manually requests a lesson plan generation
 * or wants to regenerate an existing plan.
 */
export class GenerateLessonPlanDto {
  /**
   * Student's level: beginner, intermediate, or advanced
   * If not provided, defaults to "beginner"
   */
  @ApiProperty({
    description: 'Student level',
    enum: ['beginner', 'intermediate', 'advanced'],
    required: false,
    default: 'beginner',
  })
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  @IsOptional()
  level?: string;

  /**
   * Learning goal for this session
   * Example: "learn basic chords", "practice French conversation"
   * If not provided, uses session notes or a default goal
   */
  @ApiProperty({
    description: 'Learning goal for the session',
    required: false,
    example: 'Learn basic guitar chords',
  })
  @IsString()
  @IsOptional()
  goal?: string;
}

/**
 * DTO for updating progress on a checklist item
 */
export class UpdateProgressDto {
  /**
   * Index of the checklist item (0-based)
   */
  @ApiProperty({
    description: 'Index of the checklist item',
    example: 0,
  })
  checklistIndex: number;

  /**
   * Whether the item is completed
   */
  @ApiProperty({
    description: 'Whether the checklist item is completed',
    example: true,
  })
  completed: boolean;
}

