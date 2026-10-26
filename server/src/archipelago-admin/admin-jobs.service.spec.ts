import type { AdminConnection, AdminConnectionTarget, ServerReply } from './admin-connection.js';
import { AdminJobsService, ServerLoginError, type AdminJob, type AdminTiming } from './admin-jobs.service.js';

const TIMING: AdminTiming = {
  pauseMilliseconds: 0,
  replyWaitMilliseconds: 0,
  loginTimeoutMilliseconds: 50,
  pollMilliseconds: 1,
  reconnectMilliseconds: 1,
  reconnectTimeoutMilliseconds: 20,
  connectTimeoutMilliseconds: 50,
};

const TARGET: AdminConnectionTarget = { address: 'wss://archipelago.test:38281', slotName: 'Locker' };

class FakeConnection implements AdminConnection {
  readonly said: string[] = [];
  closed = false;
  private replies: ServerReply[] = [];

  constructor(
    private readonly options: { password?: string; failOpen?: boolean; errorFor?: string; silent?: boolean } = {},
  ) {}

  open(): Promise<void> {
    return this.options.failOpen ? Promise.reject(new Error('refused')) : Promise.resolve();
  }

  say(line: string): Promise<void> {
    this.said.push(line);
    if (line.startsWith('!admin login ') && !this.options.silent) {
      const correct = line === `!admin login ${this.options.password ?? 'secret'}`;
      this.replies.push({ kind: 'CommandResult', text: correct ? 'Login successful.' : 'Password incorrect.' });
    }
    if (this.options.errorFor && line.includes(this.options.errorFor)) {
      this.replies.push({ kind: 'AdminCommandResult', text: `Unknown location ${this.options.errorFor}` });
    }
    return Promise.resolve();
  }

  takeReplies(): ServerReply[] {
    const taken = this.replies;
    this.replies = [];
    return taken;
  }

  close(): void {
    this.closed = true;
  }
}

function runJob(service: AdminJobsService, lines: string[], password = 'secret'): Promise<AdminJob> {
  return new Promise((resolve) => {
    service.start({
      roomId: 1,
      command: 'test',
      serverPassword: password,
      resolveTarget: () => Promise.resolve(TARGET),
      lines,
      onFinished: (job) => {
        resolve(job);
        return Promise.resolve();
      },
    });
  });
}

describe('AdminJobsService', () => {
  it('logs in, sends all lines, logs out and closes the connection', async () => {
    const connection = new FakeConnection();
    const service = new AdminJobsService(() => connection, TIMING);
    const job = await runJob(service, ['!admin /release Bob', '!admin /collect Bob']);
    expect(job).toMatchObject({ state: 'done', total: 2, done: 2, errors: [] });
    expect(connection.said).toEqual([
      '!admin login secret',
      '!admin /release Bob',
      '!admin /collect Bob',
      '!admin logout',
    ]);
    expect(connection.closed).toBe(true);
    expect(service.isRunning(1)).toBe(false);
    expect(service.latest(1)?.id).toBe(job.id);
  });

  it('collects the error answers of the server', async () => {
    const connection = new FakeConnection({ errorFor: 'Nowhere' });
    const service = new AdminJobsService(() => connection, TIMING);
    const job = await runJob(service, ['!admin /send_location "Bob" "Nowhere"', '!admin /release Bob']);
    expect(job).toMatchObject({ state: 'done', done: 2, errors: ['Unknown location Nowhere'] });
  });

  it('stops after a wrong password without sending the lines', async () => {
    const connection = new FakeConnection();
    const service = new AdminJobsService(() => connection, TIMING);
    const job = await runJob(service, ['!admin /release Bob'], 'wrong');
    expect(job).toMatchObject({ state: 'failed', done: 0, errors: ['SERVER_LOGIN_FAILED'] });
    expect(connection.said).toEqual(['!admin login wrong']);
    expect(connection.closed).toBe(true);
  });

  it('fails when the server does not answer the login', async () => {
    const service = new AdminJobsService(() => new FakeConnection({ silent: true }), TIMING);
    await expect(service.testLogin(() => Promise.resolve(TARGET), 'secret')).rejects.toThrow('SERVER_LOGIN_TIMEOUT');
  });

  it('tries to connect again and then gives up', async () => {
    const resolveTarget = vi.fn(() => Promise.resolve(TARGET));
    const service = new AdminJobsService(() => new FakeConnection({ failOpen: true }), TIMING);
    await expect(service.testLogin(resolveTarget, 'secret')).rejects.toBeInstanceOf(ServerLoginError);
    expect(resolveTarget.mock.calls.length).toBeGreaterThan(1);
  });

  it('gives up when the connection does not open in time', async () => {
    const hanging: AdminConnection = {
      open: () => new Promise<void>(() => undefined),
      say: () => Promise.resolve(),
      takeReplies: () => [],
      close: () => undefined,
    };
    const service = new AdminJobsService(() => hanging, TIMING);
    await expect(service.testLogin(() => Promise.resolve(TARGET), 'secret')).rejects.toThrow('ROOM_NOT_REACHABLE');
  });

  it('logs out after a successful test login', async () => {
    const connection = new FakeConnection();
    const service = new AdminJobsService(() => connection, TIMING);
    await service.testLogin(() => Promise.resolve(TARGET), 'secret');
    expect(connection.said).toEqual(['!admin login secret', '!admin logout']);
    expect(connection.closed).toBe(true);
  });

  it('stops a running job after the current line', async () => {
    const connection = new FakeConnection();
    const service = new AdminJobsService(() => connection, { ...TIMING, pauseMilliseconds: 5 });
    const finished = runJob(service, ['!admin /release A', '!admin /release B', '!admin /release C']);
    const running = service.latest(1);
    expect(service.isRunning(1)).toBe(true);
    expect(service.stop(1, 'other')).toBe(false);
    expect(service.stop(1, running?.id ?? '')).toBe(true);
    const job = await finished;
    expect(job.state).toBe('stopped');
    expect(job.done).toBeLessThan(3);
    expect(service.stop(1, job.id)).toBe(false);
  });
});
