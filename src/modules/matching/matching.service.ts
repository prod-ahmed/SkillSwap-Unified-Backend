import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

interface RecommendationQuery {
  city?: string;
  skill?: string;
  limit?: number;
}

@Injectable()
export class MatchingService {
  constructor(private readonly usersService: UsersService) {}

  async recommendations(userId: string, query: RecommendationQuery) {
    const users = await this.usersService.findAll();
    const filtered = users.filter((u) => {
      const id = (u as any)._id?.toString?.() ?? (u as any).id ?? '';
      return id !== userId;
    }).filter((u) => {
      if (query.city && u.location?.city?.toLowerCase() !== query.city.toLowerCase()) {
        return false;
      }
      if (query.skill) {
        const teaches = u.skillsTeach?.map((s) => s.toLowerCase()) ?? [];
        const learns = u.skillsLearn?.map((s) => s.toLowerCase()) ?? [];
        const skillLower = query.skill.toLowerCase();
        return teaches.includes(skillLower) || learns.includes(skillLower);
      }
      return true;
    });
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    return filtered.slice(0, limit);
  }
}
