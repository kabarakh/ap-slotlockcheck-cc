import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { remainingValidDays, startChallengeServer } from './acme-challenge';

describe('startChallengeServer', () => {
  it('answers known challenge tokens and nothing else', async () => {
    const tokens = new Map([['token-1', 'token-1.authorization']]);
    const server = await startChallengeServer(tokens, 0);
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;
    try {
      const known = await fetch(`${base}/.well-known/acme-challenge/token-1`);
      expect(known.status).toBe(200);
      expect(await known.text()).toBe('token-1.authorization');
      expect((await fetch(`${base}/.well-known/acme-challenge/other`)).status).toBe(404);
      expect((await fetch(`${base}/index.html`)).status).toBe(404);
    } finally {
      server.close();
    }
  });
});

describe('remainingValidDays', () => {
  it('rejects text that is not a certificate', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const notACertificate = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    expect(() => remainingValidDays(notACertificate, new Date())).toThrow(/PEM/);
  });
});
