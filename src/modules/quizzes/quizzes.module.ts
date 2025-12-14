import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { QuizResult, QuizResultSchema } from './schemas/quiz-result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizResult.name, schema: QuizResultSchema },
    ]),
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
