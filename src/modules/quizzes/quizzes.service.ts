import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QuizResult, QuizResultDocument } from './schemas/quiz-result.schema';
import { CreateQuizResultDto } from './dto/create-quiz-result.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectModel(QuizResult.name)
    private quizResultModel: Model<QuizResultDocument>,
  ) {}

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
      createdAt: result.createdAt,
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
