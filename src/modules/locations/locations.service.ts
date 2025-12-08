import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

@Injectable()
export class LocationsService implements OnModuleInit {
    private readonly logger = new Logger(LocationsService.name);
    private cities: string[] = [];
    private readonly DATA_URL =
        'https://gist.githubusercontent.com/marwein/75c58e05064313a5b60e/raw/tunisia.json';

    async onModuleInit() {
        await this.fetchCities();
    }

    async fetchCities() {
        try {
            this.logger.log('Fetching cities from external API...');
            const response = await fetch(this.DATA_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.statusText}`);
            }
            const data = await response.json();

            const delegations = new Set<string>();

            // Data structure is { "Governorate": [ { "delegation": "Name", ... }, ... ] }
            for (const governorate in data) {
                if (Array.isArray(data[governorate])) {
                    for (const item of data[governorate]) {
                        if (item.delegation) {
                            delegations.add(item.delegation);
                        }
                    }
                }
            }

            this.cities = Array.from(delegations).sort();
            this.logger.log(`Successfully loaded ${this.cities.length} cities.`);
        } catch (error) {
            this.logger.error('Error fetching cities:', error);
            // Fallback to basic list if fetch fails
            this.cities = [
                'Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabès', 'Ariana', 'Gafsa'
            ];
        }
    }

    getCities(): string[] {
        return this.cities;
    }
}
