import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/schemas/user.schema';

@Controller('locations')
export class LocationsController {
    constructor(
        private readonly locationsService: LocationsService,
        private readonly usersService: UsersService,
    ) { }

    @Get('cities')
    getCities(): string[] {
        return this.locationsService.getCities();
    }

    @Get('filters')
    async getFilters(): Promise<{ cities: string[]; skills: string[] }> {
        const cities = this.locationsService.getCities();
        let skills: string[] = [];
        const users: User[] = await this.usersService.findAll();
        const collected = new Set<string>();
        users.forEach((u) => {
            (u.skillsTeach || []).forEach((s) => collected.add(s));
            (u.skillsLearn || []).forEach((s) => collected.add(s));
        });
        skills = Array.from(collected).sort((a, b) => a.localeCompare(b));
        return { cities, skills };
    }
}
