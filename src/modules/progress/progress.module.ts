import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { ProgressGoal, ProgressGoalSchema } from './schemas/progress-goal.schema';
import { WeeklyObjective, WeeklyObjectiveSchema } from './schemas/weekly-objective.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Session, SessionSchema } from '../sessions/entities/session.entity';
import { WeeklyObjectiveController } from './weekly-objective.controller';
import { WeeklyObjectiveService } from './weekly-objective.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProgressGoal.name, schema: ProgressGoalSchema },
      { name: WeeklyObjective.name, schema: WeeklyObjectiveSchema },
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [ProgressController, WeeklyObjectiveController],
  providers: [ProgressService, WeeklyObjectiveService],
})
export class ProgressModule {}
