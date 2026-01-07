import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
    namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(NotificationsGateway.name);
    private userSocketMap = new Map<string, string>(); // userId -> socketId

    handleConnection(client: Socket) {
        this.logger.log(`======== NOTIFICATIONS CLIENT CONNECTED ========`);
        this.logger.log(`Client ID: ${client.id}`);

        // Extract userId from handshake
        let userId = client.handshake.query.userId as string;
        if (!userId && client.handshake.auth && client.handshake.auth.userId) {
            userId = client.handshake.auth.userId;
        }

        if (userId) {
            this.userSocketMap.set(userId, client.id);
            client.data.userId = userId;
            this.logger.log(`✅ User ${userId} registered for notifications with socket ${client.id}`);

            // Send confirmation
            client.emit('connection:confirmed', {
                userId,
                socketId: client.id,
                timestamp: new Date().toISOString(),
            });
        } else {
            this.logger.warn(`⚠️ Client ${client.id} connected without userId`);
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (userId) {
            this.userSocketMap.delete(userId);
            this.logger.log(`❌ User ${userId} disconnected from notifications`);
        }
    }

    /**
     * Push a notification to a specific user
     */
    pushToUser(userId: string, notification: any) {
        const socketId = this.userSocketMap.get(userId);
        if (socketId) {
            this.server.to(socketId).emit('notification:new', notification);
            this.logger.log(`📤 Pushed notification to user ${userId}`);
            return true;
        } else {
            this.logger.warn(`⚠️ User ${userId} not connected to notifications socket`);
            return false;
        }
    }

    /**
     * Push match notification
     */
    pushMatchNotification(userId: string, matchData: any) {
        return this.pushToUser(userId, {
            type: 'match',
            ...matchData,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Push message notification  
     */
    pushMessageNotification(userId: string, messageData: any) {
        return this.pushToUser(userId, {
            type: 'message',
            ...messageData,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Push call notification
     */
    pushCallNotification(userId: string, callData: any) {
        return this.pushToUser(userId, {
            type: 'call',
            ...callData,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Push session notification
     */
    pushSessionNotification(userId: string, sessionData: any) {
        return this.pushToUser(userId, {
            type: 'session',
            ...sessionData,
            timestamp: new Date().toISOString(),
        });
    }
}
