import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QuizResult, QuizResultDocument } from './schemas/quiz-result.schema';
import { CreateQuizResultDto } from './dto/create-quiz-result.dto';
import { CloudflareAIService } from '../cloudflare-ai/cloudflare-ai.service';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(QuizResult.name)
    private quizResultModel: Model<QuizResultDocument>,
    private cloudflareAIService: CloudflareAIService,
  ) {}

  async generateQuiz(skill: string, level: string, numberOfQuestions: number = 5) {
    const systemPrompt = `You are a quiz generator. Generate quiz questions in valid JSON format only. Do not include any explanatory text, markdown formatting, or code blocks. Output ONLY the raw JSON object.`;
    
    const userPrompt = `Generate ${numberOfQuestions} multiple-choice quiz questions about ${skill} at ${level} level.

Return a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}

Requirements:
- correctAnswer is the index (0-3) of the correct option
- Questions should be relevant to ${skill}
- Difficulty should match ${level} level
- Each question must have exactly 4 options
- Return ONLY valid JSON, no other text`;

    try {
      const response = await this.cloudflareAIService.generateText(userPrompt, {
        systemPrompt,
        maxTokens: 2048,
        temperature: 0.7,
      });

      // Clean up the response - remove markdown code blocks if present
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
      }

      const quizData = JSON.parse(cleanedResponse);
      
      return {
        skill,
        level,
        questions: quizData.questions,
        totalQuestions: quizData.questions.length,
      };
    } catch (error) {
      console.error('Quiz generation error:', error);
      throw new Error('Failed to generate quiz: ' + (error.message || error));
    }
  }

  async saveResult(userId: string, dto: CreateQuizResultDto) {
    const percentage = Math.round((dto.score / dto.totalQuestions) * 100);

    const result = await this.quizResultModel.create({
      userId: new Types.ObjectId(userId),
      skill: dto.skill,
      level: dto.level,
      score: dto.score,
      totalQuestions: dto.totalQuestions,
      percentage,
      answers: dto.answers || [],
      completedAt: new Date(),
    });

    return {
      id: result._id,
      userId: result.userId,
      skill: result.skill,
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: result.percentage,
      completedAt: result.completedAt,
    };
  }

  async getUserResults(userId: string) {
    const results = await this.quizResultModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ completedAt: -1 })
      .limit(50)
      .lean();

    // Calculate stats
    const totalQuizzes = results.length;
    const averageScore = totalQuizzes > 0
      ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / totalQuizzes)
      : 0;

    // Get top skills
    const skillCounts: Record<string, number> = {};
    results.forEach(r => {
      skillCounts[r.skill] = (skillCounts[r.skill] || 0) + 1;
    });
    const topSkills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill]) => skill);

    return {
      results: results.map(r => ({
        id: r._id,
        skill: r.skill,
        score: r.score,
        totalQuestions: r.totalQuestions,
        percentage: r.percentage,
        completedAt: r.completedAt,
      })),
      stats: {
        totalQuizzes,
        averageScore,
        topSkills,
      },
    };
  }

  async getSkillProgress(userId: string, skill: string) {
    const results = await this.quizResultModel
      .find({ 
        userId: new Types.ObjectId(userId),
        skill 
      })
      .sort({ completedAt: -1 })
      .lean();

    return results.map(r => ({
      id: r._id,
      level: r.level,
      score: r.score,
      totalQuestions: r.totalQuestions,
      percentage: r.percentage,
      completedAt: r.completedAt,
    }));
  }
}
