import { Injectable, Logger } from '@nestjs/common';

export interface ActiveCall {
    callId: string;
    callerId: string;
    recipientId: string;
    type: 'audio' | 'video';
    status: 'ringing' | 'active' | 'ended';
    startedAt: Date;
}

@Injectable()
export class CallingService {
    private readonly logger = new Logger(CallingService.name);
    private activeCalls = new Map<string, ActiveCall>();
    public userSocketMap = new Map<string, string>(); // userId -> socketId

    registerUserSocket(userId: string, socketId: string) {
        this.userSocketMap.set(userId, socketId);
        this.logger.log(`[CallingService] User ${userId} registered with socket ${socketId}`);
        this.logger.log(`[CallingService] Current registered users: ${Array.from(this.userSocketMap.keys())}`);
    }

    unregisterUserSocket(userId: string) {
        this.userSocketMap.delete(userId);
        this.logger.log(`User ${userId} disconnected`);
    }

    getSocketIdForUser(userId: string): string | undefined {
        return this.userSocketMap.get(userId);
    }

    createCall(callId: string, callerId: string, recipientId: string, type: 'audio' | 'video'): ActiveCall {
        const call: ActiveCall = {
            callId,
            callerId,
            recipientId,
            type,
            status: 'ringing',
            startedAt: new Date(),
        };
        this.activeCalls.set(callId, call);
        this.logger.log(`Call ${callId} created: ${callerId} -> ${recipientId} (${type})`);
        return call;
    }

    updateCallStatus(callId: string, status: ActiveCall['status']) {
        const call = this.activeCalls.get(callId);
        if (call) {
            call.status = status;
            this.logger.log(`Call ${callId} status updated to ${status}`);
        }
    }

    endCall(callId: string) {
        const call = this.activeCalls.get(callId);
        if (call) {
            call.status = 'ended';
            this.activeCalls.delete(callId);
            this.logger.log(`Call ${callId} ended`);
        }
    }

    getCall(callId: string): ActiveCall | undefined {
        return this.activeCalls.get(callId);
    }

    getActiveCallsForUser(userId: string): ActiveCall[] {
        return Array.from(this.activeCalls.values()).filter(
            call => call.callerId === userId || call.recipientId === userId
        );
    }
}
