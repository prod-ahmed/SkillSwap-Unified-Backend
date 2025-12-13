import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
