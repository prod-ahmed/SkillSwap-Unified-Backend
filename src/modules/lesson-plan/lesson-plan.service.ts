import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LessonPlan, LessonPlanDocument } from './schemas/lesson-plan.schema';
import { Session, SessionDocument } from '../sessions/entities/session.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { GeminiService } from '../gemini/gemini.service';
import { jsonrepair } from 'jsonrepair';

/**
 * Interface for Gemini response
 * The AI returns a structured JSON with lesson plan components
 */
interface GeminiLessonPlanResponse {
  plan: string | Record<string, unknown>;
  checklist: string[];
  resources: string[];
  homework: string;
}

/**
 * Lesson Plan Service
 * 
 * This service handles:
 * 1. Generating AI-powered lesson plans using Gemini API
 * 2. Storing and retrieving lesson plans from database
 * 3. Updating progress tracking for checklist items
 * 4. Sending notifications when plans are generated
 * 
 * The service integrates with Gemini model to create
 * personalized lesson plans based on:
 * - Skill being taught
 * - Student's level (beginner/intermediate/advanced)
 * - Session duration
 * - Learning goal
 */
@Injectable()
export class LessonPlanService {
  private readonly logger = new Logger(LessonPlanService.name);

  /**
   * Constructor
   * 
   * Injects required services (notifications, Gemini generator, etc.)
   */
  constructor(
    @InjectModel(LessonPlan.name)
    private lessonPlanModel: Model<LessonPlanDocument>,
    @InjectModel(Session.name)
    private sessionModel: Model<SessionDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly geminiService: GeminiService,
  ) { }

  /**
   * Generate a lesson plan for a session using Gemini
   * 
   * This method:
   * 1. Fetches session details (skill, duration, etc.)
   * 2. Constructs a prompt for Gemini
   * 3. Calls Gemini API to generate the plan
   * 4. Saves the plan to database
   * 5. Sends notification to teacher and learner
   * 
   * @param sessionId - The ID of the session to generate a plan for
   * @param level - Student's level (beginner/intermediate/advanced)
   * @param goal - Learning goal for the session
   * @returns The generated lesson plan document
   */
  async generateLessonPlan(
    sessionId: string,
    level: string = 'beginner',
    goal?: string,
  ): Promise<LessonPlanDocument> {
    // Fetch session details
    const session = await this.sessionModel
      .findById(sessionId)
      .populate('teacher', 'username')
      .populate('students', 'username')
      .exec();

    if (!session) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    // Check if a lesson plan already exists
    const existingPlan = await this.lessonPlanModel.findOne({
      sessionId: new Types.ObjectId(sessionId),
    });

    if (existingPlan) {
      this.logger.log(
        `Lesson plan already exists for session ${sessionId}. Use regenerate to create a new one.`,
      );
      return existingPlan;
    }

    // Use goal from parameter, session notes, or default
    const learningGoal =
      goal || session.notes || `Learn ${session.skill} basics`;

    // Construct the prompt for Gemini
    const prompt = this.buildPrompt(
      session.skill,
      level,
      session.duration,
      learningGoal,
    );

    this.logger.log(
      `Generating lesson plan for session ${sessionId} (${session.skill}, ${level}, ${session.duration}min)`,
    );

    try {
      // Call Gemini API
      const aiResponse = await this.callGemini(prompt);

      const planText =
        typeof aiResponse.plan === 'string'
          ? aiResponse.plan
          : JSON.stringify(aiResponse.plan, null, 2);

      // Create lesson plan document
      const lessonPlan = new this.lessonPlanModel({
        sessionId: new Types.ObjectId(sessionId),
        skill: session.skill,
        level,
        duration: session.duration,
        goal: learningGoal,
        plan: planText,
        checklist: aiResponse.checklist || [],
        resources: aiResponse.resources || [],
        homework: aiResponse.homework || '',
        progress: new Map<string, boolean>(),
      });

      // Save to database
      const savedPlan = await lessonPlan.save();

      this.logger.log(`Lesson plan generated and saved for session ${sessionId}`);

      // Send notifications to teacher and students
      await this.notifyPlanGenerated(session, savedPlan);

      return savedPlan;
    } catch (error) {
      this.logger.error(
        `Failed to generate lesson plan for session ${sessionId}`,
        error,
      );
      throw new BadRequestException(
        `Failed to generate lesson plan: ${error.message}`,
      );
    }
  }

  /**
   * Regenerate a lesson plan (creates a new one, replacing the old)
   * 
   * @param sessionId - The ID of the session
   * @param level - Optional new level
   * @param goal - Optional new goal
   * @returns The newly generated lesson plan
   */
  async regenerateLessonPlan(
    sessionId: string,
    level?: string,
    goal?: string,
  ): Promise<LessonPlanDocument> {
    // Delete existing plan if it exists
    await this.lessonPlanModel.deleteOne({
      sessionId: new Types.ObjectId(sessionId),
    });

    // Generate new plan
    return this.generateLessonPlan(sessionId, level, goal);
  }

  /**
   * Get an existing lesson plan for a session
   * 
   * @param sessionId - The ID of the session
   * @returns The lesson plan document or null if not found
   */
  async getLessonPlan(sessionId: string): Promise<LessonPlanDocument | null> {
    const plan = await this.lessonPlanModel
      .findOne({
        sessionId: new Types.ObjectId(sessionId),
      })
      .exec();

    return plan;
  }

  /**
   * Update progress for a checklist item
   * 
   * When a learner checks off a checklist item, this method
   * updates the progress map to track completion status.
   * 
   * @param sessionId - The ID of the session
   * @param checklistIndex - Index of the checklist item (0-based)
   * @param completed - Whether the item is completed
   * @returns The updated lesson plan
   */
  async updateProgress(
    sessionId: string,
    checklistIndex: number,
    completed: boolean,
  ): Promise<LessonPlanDocument> {
    const plan = await this.lessonPlanModel.findOne({
      sessionId: new Types.ObjectId(sessionId),
    });

    if (!plan) {
      throw new NotFoundException(
        `Lesson plan not found for session ${sessionId}`,
      );
    }

    // Update progress map
    const progress = plan.progress || new Map<string, boolean>();
    progress.set(checklistIndex.toString(), completed);
    plan.progress = progress;

    // Save updated plan
    const updated = await plan.save();

    this.logger.log(
      `Updated progress for session ${sessionId}, item ${checklistIndex}: ${completed}`,
    );

    return updated;
  }

  /**
   * Build the prompt for Gemini
   * 
   * Creates a structured prompt that instructs the AI to generate
   * a comprehensive lesson plan in JSON format.
   * 
   * @param skill - The skill being taught
   * @param level - Student's level
   * @param duration - Session duration in minutes
   * @param goal - Learning goal
   * @returns The formatted prompt string
   */
  private buildPrompt(
    skill: string,
    level: string,
    duration: number,
    goal: string,
  ): string {
    return `You are an expert educational content creator. Generate a structured lesson plan for a learning session.

Skill: ${skill}
Level: ${level}
Duration: ${duration} minutes
Goal: ${goal}

Return a JSON object with the following structure:
{
  "plan": "A single multi-line text string describing the lesson plan with headings (Warm-up, Main learning blocks, Practice, Summary). Do NOT return objects for this field.",
  "checklist": ["List of 3-5 learning objectives that can be checked off", "Each objective should be specific and measurable"],
  "resources": ["List of 2-4 recommended resources (YouTube videos, PDFs, articles, practice apps)", "Include actual URLs if possible, or describe the resource"],
  "homework": "Small exercises and recap of what was learned, plus next recommended steps for continued practice"
}

Make the content appropriate for a ${level} level student learning ${skill}. The lesson should be practical and engaging.`;
  }

  /**
   * Call Gemini API to generate the lesson plan
   * 
   * Uses the GeminiService wrapper to keep this class focused on
   * business logic rather than API plumbing.
   * 
   * @param prompt - The prompt to send to Gemini
   * @returns Parsed lesson plan data from AI
   */
  private async callGemini(
    prompt: string,
  ): Promise<GeminiLessonPlanResponse> {
    try {
      const rawResponse = await this.geminiService.generateText(prompt);

      if (!rawResponse) {
        throw new Error('No content received from Gemini');
      }

      // Parse JSON response
      // Sometimes Gemini wraps JSON in markdown code blocks, so we clean it
      const cleanedContent = rawResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      let parsed: GeminiLessonPlanResponse;
      try {
        parsed = JSON.parse(cleanedContent);
      } catch (primaryError) {
        try {
          const repaired = jsonrepair(cleanedContent);
          parsed = JSON.parse(repaired);
        } catch (repairError) {
          this.logger.error('Failed to parse Gemini response', repairError);
          throw new Error('Invalid JSON returned from Gemini');
        }
      }

      // Validate response structure
      if (!parsed.plan || !Array.isArray(parsed.checklist)) {
        throw new Error('Invalid response structure from Gemini');
      }

      if (typeof parsed.plan !== 'string') {
        parsed.plan = JSON.stringify(parsed.plan, null, 2);
      }
      parsed.checklist = Array.isArray(parsed.checklist)
        ? parsed.checklist
        : [];
      parsed.resources = Array.isArray(parsed.resources)
        ? parsed.resources
        : [];
      parsed.homework = typeof parsed.homework === 'string' ? parsed.homework : '';

      this.logger.log('Successfully generated lesson plan from Gemini');
      return parsed;
    } catch (error) {
      this.logger.error('Gemini API call failed', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to generate lesson plan: ${error.message}`,
      );
    }
  }

  /**
   * Send notifications when a lesson plan is generated
   * 
   * Notifies both the teacher and all students that a lesson plan
   * is ready for their upcoming session.
   * 
   * @param session - The session document
   * @param plan - The generated lesson plan
   */
  private async notifyPlanGenerated(
    session: SessionDocument,
    plan: LessonPlanDocument,
  ): Promise<void> {
    const notificationTitle = 'Plan de cours généré';
    const notificationMessage = `Le plan de cours pour "${session.title}" est prêt !`;

    // Notify teacher
    // Notify teacher
    await this.notificationsService.sendNotification({
      userId: session.teacher.toString(),
      type: 'lesson_plan_generated' as any,
      title: notificationTitle,
      message: notificationMessage,
      sessionId: session._id.toString(),
    });

    // Notify all students/participants
    const allStudents = [
      ...(session.students || []),
      ...(session.participants || []),
    ];

    for (const studentId of allStudents) {
      await this.notificationsService.sendNotification({
        userId: studentId.toString(),
        type: 'lesson_plan_generated' as any,
        title: notificationTitle,
        message: notificationMessage,
        sessionId: session._id.toString(),
      });
    }

    this.logger.log(
      `Sent lesson plan notifications for session ${session._id}`,
    );
  }
}

