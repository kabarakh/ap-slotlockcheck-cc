import acme from 'acme-client';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { remainingValidDays, startChallengeServer, type ChallengeTokens } from './acme-challenge.ts';
import { publicDevHost } from './public-dev-host.ts';

const RENEW_BEFORE_DAYS = 30;
const certificateDirectory = join(import.meta.dirname, '..', '.certs');
const domain = publicDevHost();
const port = Number(process.env.ACME_HTTP_PORT ?? 80);
const email = process.env.ACME_EMAIL;
const useStaging = process.argv.includes('--staging');
const force = process.argv.includes('--force');

const certificateFile = join(certificateDirectory, `${domain}.crt`);
const keyFile = join(certificateDirectory, `${domain}.key`);
const accountKeyFile = join(certificateDirectory, useStaging ? 'account-staging.key' : 'account.key');

async function accountKey(): Promise<Buffer> {
  if (existsSync(accountKeyFile)) {
    return readFileSync(accountKeyFile);
  }
  const key = await acme.crypto.createPrivateKey();
  writeFileSync(accountKeyFile, key, { mode: 0o600 });
  return key;
}

async function requestCertificate(): Promise<void> {
  mkdirSync(certificateDirectory, { recursive: true });
  if (!force && existsSync(certificateFile)) {
    const days = remainingValidDays(readFileSync(certificateFile, 'utf8'), new Date());
    if (days > RENEW_BEFORE_DAYS) {
      process.stdout.write(`The certificate for ${domain} is valid for ${days} more days. Use --force to renew.\n`);
      return;
    }
  }

  const client = new acme.Client({
    directoryUrl: useStaging ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production,
    accountKey: await accountKey(),
  });
  const [key, csr] = await acme.crypto.createCsr({ altNames: [domain] });
  const tokens: ChallengeTokens = new Map();
  const server = await startChallengeServer(tokens, port);
  process.stdout.write(`Waiting for Let's Encrypt on http://${domain}/ (local port ${port}) ...\n`);

  try {
    const certificate = await client.auto({
      csr,
      email,
      termsOfServiceAgreed: true,
      challengePriority: ['http-01'],
      challengeCreateFn: async (_authorization, challenge, keyAuthorization) => {
        tokens.set(challenge.token, keyAuthorization);
      },
      challengeRemoveFn: async (_authorization, challenge) => {
        tokens.delete(challenge.token);
      },
    });
    writeFileSync(keyFile, key, { mode: 0o600 });
    writeFileSync(certificateFile, certificate);
    const days = remainingValidDays(certificate, new Date());
    process.stdout.write(`Certificate for ${domain} saved in ${certificateDirectory}. It is valid for ${days} days.\n`);
  } finally {
    server.close();
  }
}

await requestCertificate();
