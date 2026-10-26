import { ArchipelagoAdminConnection } from '../src/archipelago-admin/admin-connection.js';
import {
  AdminJobsService,
  DEFAULT_ADMIN_TIMING,
  type AdminJob,
  type AdminTiming,
} from '../src/archipelago-admin/admin-jobs.service.js';
import { startFakeArchipelagoServer, type FakeArchipelagoServer } from './support/fake-archipelago-server.js';

const TIMING: AdminTiming = { ...DEFAULT_ADMIN_TIMING, pauseMilliseconds: 20, replyWaitMilliseconds: 100 };

describe('Archipelago connection with archipelago.js (integration)', () => {
  let fakeServer: FakeArchipelagoServer;
  let service: AdminJobsService;

  const target = () =>
    Promise.resolve({ address: `ws://127.0.0.1:${fakeServer.port}`, slotName: 'Locker', roomPassword: 'room-secret' });

  beforeEach(async () => {
    fakeServer = await startFakeArchipelagoServer('room-secret');
    service = new AdminJobsService(() => new ArchipelagoAdminConnection(), TIMING);
  });

  afterEach(async () => {
    await fakeServer.close();
  });

  it('connects as text client of the SlotLock slot with the room password and logs in', async () => {
    await service.testLogin(target, 'admin-secret');
    expect(fakeServer.connects[0]).toMatchObject({
      name: 'Locker',
      game: '',
      password: 'room-secret',
      tags: expect.arrayContaining(['TextOnly']) as unknown,
    });
    expect(fakeServer.said).toEqual(['!admin login admin-secret', '!admin logout']);
  });

  it('reports a wrong admin password', async () => {
    await expect(service.testLogin(target, 'wrong')).rejects.toThrow('SERVER_LOGIN_FAILED');
  });

  it('sends the lines and collects the error answers', async () => {
    const job = await new Promise<AdminJob>((resolve) => {
      service.start({
        roomId: 1,
        command: 'send_location',
        serverPassword: 'admin-secret',
        resolveTarget: target,
        lines: ['!admin /send_location "Bob" "Nowhere"', '!admin /release Bob'],
        onFinished: (finished) => {
          resolve(finished);
          return Promise.resolve();
        },
      });
    });
    expect(job).toMatchObject({ state: 'done', done: 2, errors: ['Could not find location Nowhere'] });
    expect(fakeServer.said).toEqual([
      '!admin login admin-secret',
      '!admin /send_location "Bob" "Nowhere"',
      '!admin /release Bob',
      '!admin logout',
    ]);
  });
});
