import { Injectable } from '@nestjs/common';

export interface AdminSession {
  slotId: number;
  serverPassword: string;
  roomPassword?: string;
}

@Injectable()
export class AdminSessionService {
  private readonly sessions = new Map<number, AdminSession>();

  get(roomId: number): AdminSession | undefined {
    return this.sessions.get(roomId);
  }

  set(roomId: number, session: AdminSession): void {
    this.sessions.set(roomId, session);
  }

  delete(roomId: number): void {
    this.sessions.delete(roomId);
  }
}
