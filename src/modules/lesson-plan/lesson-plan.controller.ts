import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LessonPlanService } from './lesson-plan.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/common/current-user.decorator';
import {
  GenerateLessonPlanDto,
  UpdateProgressDto,
} from './dto/generate-lesson-plan.dto';
import { Session, SessionDocument } from '../sessions/entities/session.entity';

/**
 * Lesson Plan Controller
 * 
 * Handles HTTP requests for lesson plan operations:
 * - Generate new lesson plans
 * - Get existing lesson plans
 * - Update progress tracking
 * 
 * All routes are protected with JWT authentication.
 * Only teachers and learners of a session can access its lesson plan.
 */
@ApiTags('lesson-plan')
@Controller('lesson-plan')
@UseGuards(JwtAuthGuard)
export class LessonPlanController {
  constructor(
    private readonly lessonPlanService: LessonPlanService,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * Generate a new lesson plan for a session
   * 
   * POST /lesson-plan/generate/:sessionId
   * 
   * This endpoint:
   * 1. Verifies the user has access to the session (teacher or learner)
   * 2. Calls OpenAI to generate a personalized lesson plan
   * 3. Saves the plan to database
   * 4. Sends notifications to teacher and learners
   * 
   * If a plan already exists, it returns the existing plan.
   * Use the regenerate endpoint to create a new one.
   * 
   * @param sessionId - The ID of the session
   * @param dto - Optional level and goal parameters
   * @param user - Current authenticated user (from JWT)
   * @returns The generated lesson plan
   */
  @Post('generate/:sessionId')
  @ApiOperation({ summary: 'Generate a lesson plan for a session' })
  @ApiResponse({
    status: 201,
    description: 'Lesson plan generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateLessonPlan(
    @Param('sessionId') sessionId: string,
    @Body() dto: GenerateLessonPlanDto,
    @CurrentUser() user: any,
  ) {
    // Verify user has access to this session
    await this.verifySessionAccess(sessionId, user.userId);

    // Generate the plan
    const plan = await this.lessonPlanService.generateLessonPlan(
      sessionId,
      dto.level || 'beginner',
      dto.goal,
    );

    return {
      message: 'Plan de cours généré avec succès',
      data: plan,
    };
  }

  /**
   * Regenerate a lesson plan (replaces existing one)
   *
   * POST /lesson-plan/regenerate/:sessionId
   * 
   * Deletes the existing plan and creates a new one.
   * Useful when the teacher wants to update the plan.
   * 
   * @param sessionId - The ID of the session
   * @param dto - Optional level and goal parameters
   * @param user - Current authenticated user
   * @returns The newly generated lesson plan
   */
  @Post('regenerate/:sessionId')
  @ApiOperation({ summary: 'Regenerate a lesson plan for a session' })
  @ApiResponse({ status: 201, description: 'Lesson plan regenerated successfully' })
  async regenerateLessonPlan(
    @Param('sessionId') sessionId: string,
    @Body() dto: GenerateLessonPlanDto,
    @CurrentUser() user: any,
  ) {
    // Verify user has access
    await this.verifySessionAccess(sessionId, user.userId);

    // Regenerate the plan
    const plan = await this.lessonPlanService.regenerateLessonPlan(
      sessionId,
      dto.level,
      dto.goal,
    );

    return {
      message: 'Plan de cours régénéré avec succès',
      data: plan,
    };
  }

  /**
   * Get an existing lesson plan for a session
   * 
   * GET /lesson-plan/:sessionId
   * 
   * Returns the lesson plan if it exists.
   * Returns null if no plan has been generated yet.
   * 
   * @param sessionId - The ID of the session
   * @param user - Current authenticated user
   * @returns The lesson plan or null
   */
  @Get(':sessionId')
  @ApiOperation({ summary: 'Get lesson plan for a session' })
  @ApiResponse({
    status: 200,
    description: 'Lesson plan retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getLessonPlan(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: any,
  ) {
    // Verify user has access
    await this.verifySessionAccess(sessionId, user.userId);

    // Get the plan
    const plan = await this.lessonPlanService.getLessonPlan(sessionId);

    if (!plan) {
      return {
        message: 'Aucun plan de cours trouvé pour cette session',
        data: null,
      };
    }

    return {
      message: 'Plan de cours récupéré avec succès',
      data: plan,
    };
  }

  /**
   * Update progress for a checklist item
   * 
   * PATCH /lesson-plan/progress/:sessionId
   * 
   * When a learner checks off a checklist item, this endpoint
   * updates the progress tracking in the lesson plan.
   * 
   * @param sessionId - The ID of the session
   * @param dto - Checklist index and completion status
   * @param user - Current authenticated user
   * @returns The updated lesson plan
   */
  @Patch('progress/:sessionId')
  @ApiOperation({ summary: 'Update progress for a checklist item' })
  @ApiResponse({ status: 200, description: 'Progress updated successfully' })
  async updateProgress(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: any,
  ) {
    // Verify user has access
    await this.verifySessionAccess(sessionId, user.userId);

    // Update progress
    const plan = await this.lessonPlanService.updateProgress(
      sessionId,
      dto.checklistIndex,
      dto.completed,
    );

    return {
      message: 'Progression mise à jour avec succès',
      data: plan,
    };
  }

  /**
   * Verify that the current user has access to the session
   * 
   * A user can access a lesson plan if they are:
   * - The teacher of the session
   * - A student/participant in the session
   * 
   * @param sessionId - The ID of the session
   * @param userId - The ID of the current user
   * @throws BadRequestException if user doesn't have access
   */
  private async verifySessionAccess(
    sessionId: string,
    userId: string,
  ): Promise<void> {
    // Get session with populated fields
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('teacher', '_id')
      .populate('students', '_id')
      .populate('participants', '_id')
      .exec();

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    // Check if user is teacher
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const teacherId = (session.teacher as any)?._id || session.teacher;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const isTeacher = teacherId.toString() === userId;

    // Check if user is student/participant
    const allStudents = [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...((session.students || []) as any[]),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ...((session.participants || []) as any[]),
    ];
    const isStudent = allStudents.some((student: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const studentId = student._id || student;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return studentId.toString() === userId;
    });

    if (!isTeacher && !isStudent) {
      throw new BadRequestException(
        'You do not have access to this session lesson plan',
      );
    }
  }
}

