import { Module } from '@nestjs/common';
import { CallingGateway } from './calling.gateway';
import { CallingService } from './calling.service';

@Module({
    providers: [CallingGateway, CallingService],
    exports: [CallingService],
})
export class CallingModule { }
