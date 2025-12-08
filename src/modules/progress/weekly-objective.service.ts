import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WeeklyObjective, WeeklyObjectiveDocument } from './schemas/weekly-objective.schema';
import { CreateWeeklyObjectiveDto } from './dto/create-weekly-objective.dto';
import { UpdateWeeklyObjectiveDto } from './dto/update-weekly-objective.dto';

@Injectable()
export class WeeklyObjectiveService {
  constructor(
    @InjectModel(WeeklyObjective.name)
    private readonly objectiveModel: Model<WeeklyObjectiveDocument>,
  ) {}

  async getCurrent(userId: string): Promise<WeeklyObjectiveDocument> {
    const objective = await this.objectiveModel.findOne({
      user: new Types.ObjectId(userId),
      status: 'IN_PROGRESS',
    }).sort({ startDate: -1 });

    if (!objective) {
      throw new NotFoundException('No active weekly objective found');
    }

    return objective;
  }

  async getHistory(userId: string, page = 1, limit = 10): Promise<{ objectives: WeeklyObjectiveDocument[]; total: number; page: number; pages: number }> {
    const skip = (page - 1) * limit;
    const [objectives, total] = await Promise.all([
      this.objectiveModel
        .find({
          user: new Types.ObjectId(userId),
          status: 'COMPLETED',
        })
        .sort({ endDate: -1 })
        .skip(skip)
        .limit(limit),
      this.objectiveModel.countDocuments({
        user: new Types.ObjectId(userId),
        status: 'COMPLETED',
      }),
    ]);

    return {
      objectives,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async create(userId: string, dto: CreateWeeklyObjectiveDto): Promise<WeeklyObjectiveDocument> {
    // Check if user already has an active objective
    const existing = await this.objectiveModel.findOne({
      user: new Types.ObjectId(userId),
      status: 'IN_PROGRESS',
    });

    if (existing) {
      throw new ConflictException('You already have an active weekly objective. Complete or archive it first.');
    }

    const objective = new this.objectiveModel({
      user: new Types.ObjectId(userId),
      title: dto.title,
      targetHours: dto.targetHours,
      completedHours: 0,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      status: 'IN_PROGRESS',
      dailyTasks: dto.dailyTasks.map((task, index) => ({
        day: task.day || `Day ${index + 1}`,
        task: task.task,
        isCompleted: false,
      })),
    });

    return objective.save();
  }

  async update(userId: string, objectiveId: string, dto: UpdateWeeklyObjectiveDto): Promise<WeeklyObjectiveDocument> {
    const objective = await this.objectiveModel.findOne({
      _id: new Types.ObjectId(objectiveId),
      user: new Types.ObjectId(userId),
    });

    if (!objective) {
      throw new NotFoundException('Weekly objective not found');
    }

    // Update task completion status
    if (dto.taskUpdates && dto.taskUpdates.length > 0) {
      for (const update of dto.taskUpdates) {
        if (update.index >= 0 && update.index < objective.dailyTasks.length) {
          objective.dailyTasks[update.index].isCompleted = update.isCompleted;
        }
      }

      // Recalculate completed hours based on task completion
      const completedCount = objective.dailyTasks.filter(t => t.isCompleted).length;
      const totalTasks = objective.dailyTasks.length;
      objective.completedHours = totalTasks > 0 
        ? Math.round((completedCount / totalTasks) * objective.targetHours * 100) / 100
        : 0;

      // Check if all tasks are completed
      if (completedCount === totalTasks && totalTasks > 0) {
        objective.status = 'COMPLETED';
      }
    }

    return objective.save();
  }

  async complete(userId: string, objectiveId: string): Promise<WeeklyObjectiveDocument> {
    const objective = await this.objectiveModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(objectiveId),
        user: new Types.ObjectId(userId),
        status: 'IN_PROGRESS',
      },
      {
        $set: { status: 'COMPLETED' },
      },
      { new: true },
    );

    if (!objective) {
      throw new NotFoundException('Weekly objective not found or already completed');
    }

    return objective;
  }

  async delete(userId: string, objectiveId: string): Promise<{ success: boolean }> {
    const result = await this.objectiveModel.deleteOne({
      _id: new Types.ObjectId(objectiveId),
      user: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Weekly objective not found');
    }

    return { success: true };
  }
}
