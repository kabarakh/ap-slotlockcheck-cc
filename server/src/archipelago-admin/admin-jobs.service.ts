import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { adminCommands, LOGIN_FAILURE_TEXT, LOGIN_SUCCESS_TEXT } from './admin-commands.js';
import {
  ADMIN_CONNECTION_FACTORY,
  type AdminConnection,
  type AdminConnectionFactory,
  type AdminConnectionTarget,
} from './admin-connection.js';

export const ADMIN_TIMING = Symbol('ADMIN_TIMING');

export interface AdminTiming {
  pauseMilliseconds: number;
  replyWaitMilliseconds: number;
  loginTimeoutMilliseconds: number;
  pollMilliseconds: number;
  reconnectMilliseconds: number;
  reconnectTimeoutMilliseconds: number;
  connectTimeoutMilliseconds: number;
}

export const DEFAULT_ADMIN_TIMING: AdminTiming = {
  pauseMilliseconds: 300,
  replyWaitMilliseconds: 2000,
  loginTimeoutMilliseconds: 15000,
  pollMilliseconds: 100,
  reconnectMilliseconds: 2000,
  reconnectTimeoutMilliseconds: 30000,
  connectTimeoutMilliseconds: 10000,
};

export type AdminJobState = 'running' | 'done' | 'failed' | 'stopped';

export interface AdminJob {
  id: string;
  roomId: number;
  command: string;
  total: number;
  done: number;
  errors: string[];
  state: AdminJobState;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface AdminRunRequest {
  roomId: number;
  command: string;
  serverPassword: string;
  resolveTarget: () => Promise<AdminConnectionTarget>;
  lines: string[];
  onFinished: (job: AdminJob) => Promise<void>;
}

export class ServerLoginError extends Error {
  constructor(readonly code: 'SERVER_LOGIN_FAILED' | 'SERVER_LOGIN_TIMEOUT' | 'ROOM_NOT_REACHABLE') {
    super(code);
    this.name = 'ServerLoginError';
  }
}

const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class AdminJobsService {
  private readonly logger = new Logger(AdminJobsService.name);
  private readonly jobs = new Map<number, AdminJob>();
  private readonly stopRequests = new Set<string>();

  constructor(
    @Inject(ADMIN_CONNECTION_FACTORY) private readonly createConnection: AdminConnectionFactory,
    @Inject(ADMIN_TIMING) private readonly timing: AdminTiming,
  ) {}

  latest(roomId: number): AdminJob | undefined {
    return this.jobs.get(roomId);
  }

  isRunning(roomId: number): boolean {
    return this.jobs.get(roomId)?.state === 'running';
  }

  stop(roomId: number, jobId: string): boolean {
    const job = this.jobs.get(roomId);
    if (job?.id !== jobId || job.state !== 'running') {
      return false;
    }
    this.stopRequests.add(jobId);
    return true;
  }

  async testLogin(resolveTarget: () => Promise<AdminConnectionTarget>, serverPassword: string): Promise<void> {
    const connection = await this.connect(resolveTarget);
    try {
      await this.login(connection, serverPassword);
      await this.logout(connection);
    } finally {
      connection.close();
    }
  }

  start(request: AdminRunRequest): AdminJob {
    const job: AdminJob = {
      id: randomUUID(),
      roomId: request.roomId,
      command: request.command,
      total: request.lines.length,
      done: 0,
      errors: [],
      state: 'running',
      startedAt: new Date(),
      finishedAt: null,
    };
    this.jobs.set(request.roomId, job);
    void this.run(job, request);
    return job;
  }

  private async run(job: AdminJob, request: AdminRunRequest): Promise<void> {
    let connection: AdminConnection | undefined;
    try {
      connection = await this.connect(request.resolveTarget);
      await this.login(connection, request.serverPassword);
      for (const line of request.lines) {
        if (this.stopRequests.has(job.id)) {
          job.state = 'stopped';
          break;
        }
        await connection.say(line);
        await delay(this.timing.pauseMilliseconds);
        this.collectErrors(job, connection);
        job.done += 1;
      }
      await delay(this.timing.replyWaitMilliseconds);
      this.collectErrors(job, connection);
      await this.logout(connection);
      if (job.state === 'running') {
        job.state = 'done';
      }
    } catch (error) {
      job.state = 'failed';
      job.errors.push(error instanceof Error ? error.message : String(error));
    } finally {
      connection?.close();
      job.finishedAt = new Date();
      this.stopRequests.delete(job.id);
      this.logger.log(`Server command ${job.command}: ${job.state}, ${job.done}/${job.total} lines`);
      await request.onFinished(job).catch((error: unknown) => {
        this.logger.warn(`Follow-up of server command failed: ${String(error)}`);
      });
    }
  }

  private collectErrors(job: AdminJob, connection: AdminConnection): void {
    for (const reply of connection.takeReplies()) {
      if (reply.kind === 'AdminCommandResult') {
        job.errors.push(reply.text);
      }
    }
  }

  private async connect(resolveTarget: () => Promise<AdminConnectionTarget>): Promise<AdminConnection> {
    const deadline = Date.now() + this.timing.reconnectTimeoutMilliseconds;
    for (;;) {
      const connection = this.createConnection();
      try {
        await this.withTimeout(connection.open(await resolveTarget()), this.timing.connectTimeoutMilliseconds);
        return connection;
      } catch {
        connection.close();
        if (Date.now() >= deadline) {
          throw new ServerLoginError('ROOM_NOT_REACHABLE');
        }
        await delay(this.timing.reconnectMilliseconds);
      }
    }
  }

  private async logout(connection: AdminConnection): Promise<void> {
    await connection.say(adminCommands.logout());
    await delay(Math.max(this.timing.pauseMilliseconds, this.timing.pollMilliseconds));
  }

  private async withTimeout(action: Promise<void>, milliseconds: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Connection timeout')), milliseconds);
    });
    try {
      await Promise.race([action, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async login(connection: AdminConnection, serverPassword: string): Promise<void> {
    connection.takeReplies();
    await connection.say(adminCommands.login(serverPassword));
    const deadline = Date.now() + this.timing.loginTimeoutMilliseconds;
    while (Date.now() < deadline) {
      await delay(this.timing.pollMilliseconds);
      for (const reply of connection.takeReplies()) {
        const text = reply.text.toLowerCase();
        if (text.includes(LOGIN_SUCCESS_TEXT)) {
          return;
        }
        if (text.includes(LOGIN_FAILURE_TEXT)) {
          throw new ServerLoginError('SERVER_LOGIN_FAILED');
        }
      }
    }
    throw new ServerLoginError('SERVER_LOGIN_TIMEOUT');
  }
}
