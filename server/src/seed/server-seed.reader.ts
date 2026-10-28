import { Client } from 'archipelago.js';

export const SERVER_SEED_READER = Symbol('SERVER_SEED_READER');

export type ServerSeedReader = (address: string) => Promise<string>;

const CONNECT_TIMEOUT_MILLISECONDS = 10000;

export async function readServerSeedName(address: string): Promise<string> {
  const client = new Client();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Connection timeout')), CONNECT_TIMEOUT_MILLISECONDS);
  });
  try {
    const roomInfo = await Promise.race([client.socket.connect(address), timeout]);
    return roomInfo.seed_name;
  } finally {
    clearTimeout(timer);
    client.socket.disconnect();
  }
}
