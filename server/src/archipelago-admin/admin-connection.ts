import { Client, type PrintJSONPacket } from 'archipelago.js';

export type ServerReplyKind = 'CommandResult' | 'AdminCommandResult';

export interface ServerReply {
  kind: ServerReplyKind;
  text: string;
}

export interface AdminConnectionTarget {
  address: string;
  slotName: string;
  roomPassword?: string;
}

export interface AdminConnection {
  open(target: AdminConnectionTarget): Promise<void>;
  say(line: string): Promise<void>;
  takeReplies(): ServerReply[];
  close(): void;
}

export const ADMIN_CONNECTION_FACTORY = Symbol('ADMIN_CONNECTION_FACTORY');

export type AdminConnectionFactory = () => AdminConnection;

const REPLY_KINDS: readonly string[] = ['CommandResult', 'AdminCommandResult'];

export function replyFromPacket(packet: PrintJSONPacket): ServerReply | null {
  const kind = packet.type;
  if (kind === undefined || !REPLY_KINDS.includes(kind)) {
    return null;
  }
  return { kind: kind as ServerReplyKind, text: packet.data.map((part) => part.text).join('') };
}

export class ArchipelagoAdminConnection implements AdminConnection {
  private readonly client = new Client();
  private replies: ServerReply[] = [];

  async open(target: AdminConnectionTarget): Promise<void> {
    this.client.socket.on('printJSON', (packet) => {
      const reply = replyFromPacket(packet);
      if (reply) {
        this.replies.push(reply);
      }
    });
    await this.client.login(target.address, target.slotName, '', {
      password: target.roomPassword,
      slotData: false,
      tags: ['TextOnly', 'SlotLockCheck'],
    });
  }

  say(line: string): Promise<void> {
    this.client.socket.send({ cmd: 'Say', text: line });
    return Promise.resolve();
  }

  takeReplies(): ServerReply[] {
    const taken = this.replies;
    this.replies = [];
    return taken;
  }

  close(): void {
    this.client.socket.disconnect();
  }
}
