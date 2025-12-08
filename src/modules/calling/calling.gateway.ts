import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { CallingService } from './calling.service';

interface CallOfferPayload {
    recipientId: string;
    callType: 'audio' | 'video';
    sdp: string;
}

interface CallAnswerPayload {
    callId: string;
    sdp: string;
}

interface IceCandidatePayload {
    callId: string;
    candidate: any;
}

interface CallActionPayload {
    callId: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/calling',
})
export class CallingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(CallingGateway.name);

    constructor(private readonly callingService: CallingService) { }

    handleConnection(client: Socket) {
        this.logger.log(`======== CLIENT CONNECTED ========`);
        this.logger.log(`Client ID: ${client.id}`);

        // Log handshake details for debugging
        this.logger.log(`Handshake Query: ${JSON.stringify(client.handshake.query)}`);
        this.logger.log(`Handshake Auth: ${JSON.stringify(client.handshake.auth)}`);
        this.logger.log(`Handshake Headers: ${JSON.stringify(client.handshake.headers)}`);

        // Extract userId from handshake query OR auth
        let userId = client.handshake.query.userId as string;

        if (!userId && client.handshake.auth && client.handshake.auth.userId) {
            userId = client.handshake.auth.userId;
        }

        if (userId) {
            this.callingService.registerUserSocket(userId, client.id);
            client.data.userId = userId;
            this.logger.log(`✅ User ${userId} registered with socket ${client.id}`);
            this.logger.log(`📋 All registered users: ${JSON.stringify(Array.from(this.callingService.userSocketMap.entries()))}`);
            
            // Send confirmation back to client
            client.emit('connection:confirmed', { 
                userId, 
                socketId: client.id,
                timestamp: new Date().toISOString() 
            });
            this.logger.log(`📤 Sent connection:confirmed to client ${client.id}`);
        } else {
            this.logger.warn(`⚠️ Client ${client.id} connected without userId`);
        }
        this.logger.log(`======== END CLIENT CONNECTED ========`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`======== CLIENT DISCONNECTED ========`);
        this.logger.log(`Client ID: ${client.id}`);

        const userId = client.data.userId;
        if (userId) {
            this.logger.log(`User ${userId} disconnecting...`);
            this.callingService.unregisterUserSocket(userId);
            this.logger.log(`📋 Remaining registered users: ${JSON.stringify(Array.from(this.callingService.userSocketMap.entries()))}`);

            // End any active calls for this user
            const activeCalls = this.callingService.getActiveCallsForUser(userId);
            activeCalls.forEach(call => {
                this.callingService.endCall(call.callId);
                const otherUserId = call.callerId === userId ? call.recipientId : call.callerId;
                const otherSocketId = this.callingService.getSocketIdForUser(otherUserId);
                if (otherSocketId) {
                    this.server.to(otherSocketId).emit('call:ended', { callId: call.callId, reason: 'disconnect' });
                }
            });
        }
        this.logger.log(`======== END CLIENT DISCONNECTED ========`);
    }

    @SubscribeMessage('call:offer')
    handleCallOffer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CallOfferPayload,
    ) {
        this.logger.log(`======== CALL OFFER RECEIVED ========`);
        this.logger.log(`From socket: ${client.id}`);
        this.logger.log(`From user (client.data.userId): ${client.data.userId}`);
        this.logger.log(`To recipient: ${payload.recipientId}`);
        this.logger.log(`Call type: ${payload.callType}`);
        
        const callerId = client.data.userId;
        if (!callerId) {
            this.logger.error('[CallOffer] ❌ Caller not authenticated - no userId in client.data');
            client.emit('call:error', { message: 'User not authenticated' });
            return;
        }

        const callId = `${callerId}-${payload.recipientId}-${Date.now()}`;
        this.logger.log(`[CallOffer] Created callId: ${callId}`);

        const call = this.callingService.createCall(
            callId,
            callerId,
            payload.recipientId,
            payload.callType,
        );

        // Send offer to recipient
        this.logger.log(`[CallOffer] Looking up socket for recipient: ${payload.recipientId}`);
        this.logger.log(`[CallOffer] Current user socket map: ${JSON.stringify(Array.from(this.callingService.userSocketMap.entries()))}`);
        
        const recipientSocketId = this.callingService.getSocketIdForUser(payload.recipientId);

        if (!recipientSocketId) {
            this.logger.error(`[CallOffer] ❌ Recipient ${payload.recipientId} not found in registry.`);
            this.logger.error(`[CallOffer] Current Registry: ${JSON.stringify(Array.from(this.callingService.userSocketMap.entries()))}`);
            // Notify caller that recipient is offline
            client.emit('call:error', { message: 'Recipient is offline' });
            this.callingService.endCall(callId); // End the call if recipient is offline
            return;
        }

        this.logger.log(`[CallOffer] ✅ Recipient socket ID found: ${recipientSocketId}`);

        // Emit the call:incoming event
        const incomingPayload = {
            callId,
            callerId,
            callType: payload.callType,
            sdp: payload.sdp,
        };
        this.logger.log(`[CallOffer] 📤 Emitting call:incoming to socket ${recipientSocketId}`);
        this.logger.log(`[CallOffer] Payload: ${JSON.stringify({ ...incomingPayload, sdp: incomingPayload.sdp.substring(0, 100) + '...' })}`);
        
        this.server.to(recipientSocketId).emit('call:incoming', incomingPayload);
        this.logger.log(`[CallOffer] ✅ call:incoming emitted successfully`);

        // Confirm to caller
        client.emit('call:ringing', { callId });
        this.logger.log(`[CallOffer] ✅ call:ringing emitted to caller`);
        this.logger.log(`======== END CALL OFFER ========`);
    }

    @SubscribeMessage('call:answer')
    handleCallAnswer(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CallAnswerPayload,
    ) {
        const call = this.callingService.getCall(payload.callId);
        if (!call) {
            client.emit('call:error', { message: 'Call not found' });
            return;
        }

        this.callingService.updateCallStatus(payload.callId, 'active');

        // Send answer to caller
        const callerSocketId = this.callingService.getSocketIdForUser(call.callerId);
        if (callerSocketId) {
            this.server.to(callerSocketId).emit('call:answered', {
                callId: payload.callId,
                sdp: payload.sdp,
            });
        }
    }

    @SubscribeMessage('call:ice-candidate')
    handleIceCandidate(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: IceCandidatePayload,
    ) {
        const userId = client.data.userId;
        const call = this.callingService.getCall(payload.callId);

        if (!call) {
            return;
        }

        // Forward ICE candidate to the other peer
        const otherUserId = call.callerId === userId ? call.recipientId : call.callerId;
        const otherSocketId = this.callingService.getSocketIdForUser(otherUserId);

        if (otherSocketId) {
            this.server.to(otherSocketId).emit('call:ice-candidate', {
                callId: payload.callId,
                candidate: payload.candidate,
            });
        }
    }

    @SubscribeMessage('call:reject')
    handleCallReject(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CallActionPayload,
    ) {
        const call = this.callingService.getCall(payload.callId);
        if (!call) {
            return;
        }

        // Notify caller
        const callerSocketId = this.callingService.getSocketIdForUser(call.callerId);
        if (callerSocketId) {
            this.server.to(callerSocketId).emit('call:rejected', { callId: payload.callId });
        }

        this.callingService.endCall(payload.callId);
    }

    @SubscribeMessage('call:end')
    handleCallEnd(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CallActionPayload,
    ) {
        const userId = client.data.userId;
        const call = this.callingService.getCall(payload.callId);

        if (!call) {
            return;
        }

        // Notify the other peer
        const otherUserId = call.callerId === userId ? call.recipientId : call.callerId;
        const otherSocketId = this.callingService.getSocketIdForUser(otherUserId);

        if (otherSocketId) {
            this.server.to(otherSocketId).emit('call:ended', { callId: payload.callId });
        }

        this.callingService.endCall(payload.callId);
    }

    @SubscribeMessage('call:busy')
    handleCallBusy(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: CallActionPayload,
    ) {
        const call = this.callingService.getCall(payload.callId);
        if (!call) {
            return;
        }

        // Notify caller that recipient is busy
        const callerSocketId = this.callingService.getSocketIdForUser(call.callerId);
        if (callerSocketId) {
            this.server.to(callerSocketId).emit('call:busy', { callId: payload.callId });
        }

        this.callingService.endCall(payload.callId);
    }
}
