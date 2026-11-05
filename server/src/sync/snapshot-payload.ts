import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, brotliDecompress, constants } from 'node:zlib';

const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);

const COMPRESSION_QUALITY = 10;
const COMPRESSION_WINDOW_BITS = 24;

export interface StoredSnapshotPayload {
  payload: string | null;
  compressedPayload: Uint8Array | null;
}

function hashablePayload(source: string, payload: unknown): unknown {
  if (source === 'cheese' && typeof payload === 'object' && payload !== null && 'updated_at' in payload) {
    return { ...payload, updated_at: null };
  }
  return payload;
}

export function snapshotHash(source: string, payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(hashablePayload(source, payload)))
    .digest('hex');
}

export async function compressSnapshotPayload(json: string): Promise<Uint8Array<ArrayBuffer>> {
  const compressed = await compress(json, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: COMPRESSION_QUALITY,
      [constants.BROTLI_PARAM_LGWIN]: COMPRESSION_WINDOW_BITS,
      [constants.BROTLI_PARAM_SIZE_HINT]: Buffer.byteLength(json),
    },
  });
  return new Uint8Array(compressed);
}

export async function snapshotPayloadText({ payload, compressedPayload }: StoredSnapshotPayload): Promise<string> {
  if (payload !== null) {
    return payload;
  }
  if (compressedPayload === null) {
    return '';
  }
  return (await decompress(compressedPayload)).toString('utf8');
}
