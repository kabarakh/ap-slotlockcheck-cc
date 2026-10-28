import { X509Certificate } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

const CHALLENGE_PREFIX = '/.well-known/acme-challenge/';
const DAY_MS = 24 * 60 * 60 * 1000;

export type ChallengeTokens = Map<string, string>;

export function handleChallenge(tokens: ChallengeTokens, request: IncomingMessage, response: ServerResponse): void {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const token = path.startsWith(CHALLENGE_PREFIX) ? path.slice(CHALLENGE_PREFIX.length) : undefined;
  const keyAuthorization = token === undefined ? undefined : tokens.get(token);
  if (keyAuthorization === undefined) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': 'text/plain' });
  response.end(keyAuthorization);
}

export function startChallengeServer(tokens: ChallengeTokens, port: number): Promise<Server> {
  const server = createServer((request, response) => handleChallenge(tokens, request, response));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

export function remainingValidDays(certificatePem: string, now: Date): number {
  const validTo = new Date(new X509Certificate(certificatePem).validTo);
  return Math.floor((validTo.getTime() - now.getTime()) / DAY_MS);
}
