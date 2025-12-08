import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProgressGoal, ProgressGoalDocument } from './schemas/progress-goal.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Session, SessionDocument, SessionStatus } from '../sessions/entities/session.entity';
import { BADGE_CATALOG } from './badge-catalog';
import { BadgeTier } from '../users/dto/badge-tier.enum';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(ProgressGoal.name)
    private readonly goalModel: Model<ProgressGoalDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  async getDashboard(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const now = new Date();
    const startOfWeek = this.getStartOfWeek(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [user, goals, monthSessions] = await Promise.all([
      this.userModel.findById(objectId),
      this.goalModel.find({ user: objectId, status: { $ne: 'archived' } }),
      this.sessionModel.find({
        date: { $gte: startOfMonth },
        status: SessionStatus.COMPLETED,
        $or: [{ teacher: objectId }, { student: objectId }],
      }),
    ]);

    const weekSessions = monthSessions.filter((session) => session.date >= startOfWeek);

    const weeklyHours = this.sumHours(weekSessions);
    const monthlyHours = this.sumHours(monthSessions);
    const weeklyActivity = this.buildWeeklyActivity(weekSessions, startOfWeek);
    const skillProgress = this.buildSkillProgress(monthSessions);

    const goalsView = goals.map((goal) => this.buildGoalView(goal, weeklyHours, monthlyHours));
    const badgesView = this.buildBadgesView(user?.badges ?? []);

    return {
      stats: {
        weeklyHours: Number(weeklyHours.toFixed(1)),
        skillsCount: this.deriveSkillsCount(user),
      },
      goals: goalsView,
      weeklyActivity,
      skillProgress,
      badges: badgesView,
      xpSummary: {
        xp: user?.xp ?? 0,
        referralCount: user?.nombreParainnage ?? 0,
        nextBadge: this.pickNextBadge(user?.badges ?? []),
      },
    };
  }

  async createGoal(userId: string, dto: CreateGoalDto) {
    const goal = new this.goalModel({
      user: new Types.ObjectId(userId),
      title: dto.title,
      targetHours: dto.targetHours,
      period: dto.period ?? 'week',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });
    const savedGoal = await goal.save();
    const { weeklyHours, monthlyHours } = await this.getPeriodHours(userId);
    return this.buildGoalView(savedGoal, weeklyHours, monthlyHours);
  }

  async updateGoal(userId: string, goalId: string, dto: UpdateGoalDto) {
    const updatePayload: Record<string, any> = { ...dto };
    if (dto.dueDate) {
      updatePayload.dueDate = new Date(dto.dueDate);
    }

    const goal = await this.goalModel.findOneAndUpdate(
      { _id: goalId, user: new Types.ObjectId(userId) },
      { $set: updatePayload },
      { new: true },
    );
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }
    const { weeklyHours, monthlyHours } = await this.getPeriodHours(userId);
    return this.buildGoalView(goal, weeklyHours, monthlyHours);
  }

  async deleteGoal(userId: string, goalId: string) {
    const res = await this.goalModel.findOneAndUpdate(
      { _id: goalId, user: new Types.ObjectId(userId) },
      { $set: { status: 'archived' } },
      { new: true },
    );
    if (!res) {
      throw new NotFoundException('Goal not found');
    }
    return { success: true };
  }

  private sumHours<T extends { duration: number }>(sessions: T[]) {
    if (!sessions?.length) {
      return 0;
    }
    return sessions.reduce((total, session) => total + session.duration / 60, 0);
  }

  private buildWeeklyActivity(sessions: SessionDocument[], weekStart: Date) {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const hoursPerDay: Record<string, number> = {};
    days.forEach((d) => {
      hoursPerDay[d] = 0;
    });

    sessions.forEach((session) => {
      const dayIndex = (session.date.getDay() + 6) % 7; // convert JS Sunday=0 to Monday=0
      const label = days[dayIndex];
      hoursPerDay[label] += session.duration / 60;
    });

    return days.map((day) => ({ day, hours: Number(hoursPerDay[day].toFixed(2)) }));
  }

  private buildSkillProgress(sessions: SessionDocument[]) {
    const aggregates: Record<string, number> = {};
    sessions.forEach((session) => {
      const key = session.skill || 'Autre';
      aggregates[key] = (aggregates[key] ?? 0) + session.duration / 60;
    });

    return Object.entries(aggregates)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill, hours]) => ({
        skill,
        hours: Number(hours.toFixed(1)),
        level: this.deriveLevel(hours),
        progress: Math.min(100, Math.round((hours / 20) * 100)),
      }));
  }

  private deriveLevel(hours: number) {
    if (hours >= 30) return 'Avancé';
    if (hours >= 15) return 'Intermédiaire';
    return 'Débutant';
  }

  private deriveSkillsCount(user?: User | UserDocument | null) {
    if (!user) {
      return 0;
    }
    const teach = user.skillsTeach?.length ?? 0;
    const learn = user.skillsLearn?.length ?? 0;
    return teach + learn;
  }

  private pickNextBadge(currentBadges: string[]) {
    const unlocked = new Set(currentBadges as BadgeTier[]);
    const upcoming = BADGE_CATALOG.find((badge) => !unlocked.has(badge.tier));
    if (!upcoming) {
      return null;
    }
    return {
      tier: upcoming.tier,
      title: upcoming.title,
      threshold: upcoming.threshold,
    };
  }

  private buildGoalView(goal: ProgressGoalDocument, weeklyHours: number, monthlyHours: number) {
    const periodHours = goal.period === 'week' ? weeklyHours : monthlyHours;
    const ratio = goal.targetHours > 0 ? periodHours / goal.targetHours : 0;
    const progressPercent = Math.min(100, Math.round(ratio * 100));

    return {
      id: goal._id.toString(),
      title: goal.title,
      targetHours: goal.targetHours,
      currentHours: Number(periodHours.toFixed(2)),
      period: goal.period,
      status: progressPercent >= 100 ? 'completed' : goal.status,
      dueDate: goal.dueDate,
      progressPercent,
    };
  }

  private buildBadgesView(currentBadges: string[]) {
    const unlocked = new Set(currentBadges as BadgeTier[]);
    return BADGE_CATALOG.map((badge) => ({
      tier: badge.tier,
      title: badge.title,
      name: badge.title,
      description: badge.description,
      iconKey: badge.iconKey,
      icon: badge.iconKey,
      color: badge.color,
      threshold: badge.threshold,
      unlocked: unlocked.has(badge.tier),
    }));
  }

  private async getPeriodHours(userId: string) {
    const objectId = new Types.ObjectId(userId);
    const now = new Date();
    const startOfWeek = this.getStartOfWeek(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthSessions = await this.sessionModel.find({
      date: { $gte: startOfMonth },
      status: SessionStatus.COMPLETED,
      $or: [{ teacher: objectId }, { student: objectId }],
    });

    const weekSessions = monthSessions.filter((session) => session.date >= startOfWeek);

    return {
      weeklyHours: this.sumHours(weekSessions),
      monthlyHours: this.sumHours(monthSessions),
    };
  }

  private getStartOfWeek(date: Date) {
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // Monday start
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    start.setDate(date.getDate() + diff);
    return start;
  }
}
