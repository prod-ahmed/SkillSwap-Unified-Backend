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
import { Logger } from '@nestjs/common';

interface JoinThreadPayload {
    threadId: string;
}

interface TypingPayload {
    threadId: string;
    isTyping: boolean;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);
    private userSocketMap = new Map<string, string>(); // userId -> socketId

    handleConnection(client: Socket) {
        this.logger.log(`======== CHAT CLIENT CONNECTED ========`);
        this.logger.log(`Client ID: ${client.id}`);

        // Extract userId from handshake
        let userId = client.handshake.query.userId as string;
        if (!userId && client.handshake.auth && client.handshake.auth.userId) {
            userId = client.handshake.auth.userId;
        }

        if (userId) {
            this.userSocketMap.set(userId, client.id);
            client.data.userId = userId;
            this.logger.log(`✅ User ${userId} registered with chat socket ${client.id}`);

            // Send confirmation
            client.emit('connection:confirmed', {
                userId,
                socketId: client.id,
                timestamp: new Date().toISOString(),
            });
        } else {
            this.logger.warn(`⚠️ Client ${client.id} connected without userId`);
        }
        this.logger.log(`======== END CHAT CLIENT CONNECTED ========`);
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (userId) {
            this.userSocketMap.delete(userId);
            this.logger.log(`❌ User ${userId} disconnected from chat`);
        }
    }

    @SubscribeMessage('chat:join')
    handleJoinThread(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: JoinThreadPayload,
    ) {
        const { threadId } = payload;
        const userId = client.data.userId;

        this.logger.log(`📥 User ${userId} joining thread ${threadId}`);
        client.join(`thread:${threadId}`);

        client.emit('chat:joined', { threadId, timestamp: new Date().toISOString() });
        this.logger.log(`✅ User ${userId} joined thread ${threadId}`);
    }

    @SubscribeMessage('chat:leave')
    handleLeaveThread(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: JoinThreadPayload,
    ) {
        const { threadId } = payload;
        const userId = client.data.userId;

        this.logger.log(`📤 User ${userId} leaving thread ${threadId}`);
        client.leave(`thread:${threadId}`);

        this.logger.log(`✅ User ${userId} left thread ${threadId}`);
    }

    @SubscribeMessage('chat:typing')
    handleTyping(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: TypingPayload,
    ) {
        const { threadId, isTyping } = payload;
        const userId = client.data.userId;

        this.logger.log(`⌨️ User ${userId} typing in thread ${threadId}: ${isTyping}`);

        // Broadcast to other users in the thread
        client.to(`thread:${threadId}`).emit('user:typing', {
            userId,
            threadId,
            isTyping,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Broadcast a new message to all participants in a thread
     */
    broadcastMessage(threadId: string, message: any) {
        this.logger.log(`📨 Broadcasting message to thread ${threadId}`);
        this.server.to(`thread:${threadId}`).emit('message:new', message);
        this.logger.log(`✅ Message broadcasted to thread:${threadId}`);
    }

    /**
     * Emit message to specific user
     */
    emitToUser(userId: string, event: string, data: any) {
        const socketId = this.userSocketMap.get(userId);
        if (socketId) {
            this.server.to(socketId).emit(event, data);
            this.logger.log(`📤 Emitted ${event} to user ${userId}`);
        } else {
            this.logger.warn(`⚠️ User ${userId} not connected to chat socket`);
        }
    }
    /**
     * Broadcast reaction update
     */
    broadcastReaction(threadId: string, payload: { messageId: string; reactions: any }) {
        this.server.to(`thread:${threadId}`).emit('message:reaction', payload);
    }

    /**
     * Broadcast message deletion
     */
    broadcastDeletion(threadId: string, messageId: string) {
        this.server.to(`thread:${threadId}`).emit('message:deleted', { messageId });
    }
}
