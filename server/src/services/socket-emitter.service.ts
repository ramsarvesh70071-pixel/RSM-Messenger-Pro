import { Server } from 'socket.io';

export class SocketEmitter {
  private static io: Server | null = null;

  static init(serverIo: Server): void {
    this.io = serverIo;
  }

  static getIO(): Server {
    if (!this.io) {
      throw new Error('SocketEmitter not initialized. Ensure setupSocketHandlers has been called.');
    }
    return this.io;
  }

  static emitToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  static emitToChat(chatId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`chat:${chatId}`).emit(event, data);
  }

  static joinUserToChat(userId: string, chatId: string): void {
    if (!this.io) return;
    this.io.in(`user:${userId}`).socketsJoin(`chat:${chatId}`);
  }

  static leaveUserFromChat(userId: string, chatId: string): void {
    if (!this.io) return;
    this.io.in(`user:${userId}`).socketsLeave(`chat:${chatId}`);
  }

  static disconnectUser(userId: string): void {
    if (!this.io) return;
    this.io.in(`user:${userId}`).disconnectSockets(true);
  }

  static getConnectedSocketsCount(): number {
    if (!this.io) return 0;
    return this.io.sockets?.sockets?.size || 0;
  }
}
