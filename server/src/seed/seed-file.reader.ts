import { open as openFile, readFile, stat } from 'node:fs/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { MultidataFormatError } from './multidata.reader.js';

export const MAXIMUM_MULTIDATA_FILE_BYTES = 50 * 1024 * 1024;

const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const MULTIDATA_EXTENSION = '.archipelago';

async function startsWithZipSignature(path: string): Promise<boolean> {
  const handle = await openFile(path, 'r');
  try {
    const buffer = Buffer.alloc(ZIP_SIGNATURE.length);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return bytesRead === buffer.length && ZIP_SIGNATURE.every((byte, index) => buffer[index] === byte);
  } finally {
    await handle.close();
  }
}

function openZip(path: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (error, zip) => {
      if (error) {
        reject(new MultidataFormatError('INVALID_ZIP', error.message));
      } else {
        resolve(zip);
      }
    });
  });
}

function multidataEntries(zip: ZipFile): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const found: Entry[] = [];
    zip.on('entry', (entry: Entry) => {
      if (!entry.fileName.endsWith('/') && entry.fileName.toLowerCase().endsWith(MULTIDATA_EXTENSION)) {
        found.push(entry);
      }
      zip.readEntry();
    });
    zip.on('end', () => resolve(found));
    zip.on('error', (error: Error) => reject(new MultidataFormatError('INVALID_ZIP', error.message)));
    zip.readEntry();
  });
}

function readEntry(zip: ZipFile, entry: Entry, maximumBytes: number): Promise<Uint8Array> {
  if (entry.uncompressedSize > maximumBytes) {
    return Promise.reject(new MultidataFormatError('MULTIDATA_TOO_LARGE', 'The multidata file is too large'));
  }
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(new MultidataFormatError('INVALID_ZIP', error.message));
        return;
      }
      const chunks: Buffer[] = [];
      let length = 0;
      stream.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (length > maximumBytes) {
          stream.destroy(new MultidataFormatError('MULTIDATA_TOO_LARGE', 'The multidata file is too large'));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
      stream.on('error', (streamError: Error) =>
        reject(
          streamError instanceof MultidataFormatError
            ? streamError
            : new MultidataFormatError('INVALID_ZIP', streamError.message),
        ),
      );
    });
  });
}

async function readFromZip(path: string, maximumBytes: number): Promise<Uint8Array> {
  const zip = await openZip(path);
  try {
    const entries = await multidataEntries(zip);
    const [entry] = entries;
    if (!entry) {
      throw new MultidataFormatError('ZIP_WITHOUT_MULTIDATA', 'The ZIP file contains no multidata file');
    }
    if (entries.length > 1) {
      throw new MultidataFormatError('ZIP_WITH_MORE_MULTIDATA', 'The ZIP file contains more than one multidata file');
    }
    return await readEntry(zip, entry, maximumBytes);
  } finally {
    zip.close();
  }
}

export async function readSeedFile(path: string, maximumBytes = MAXIMUM_MULTIDATA_FILE_BYTES): Promise<Uint8Array> {
  if (await startsWithZipSignature(path)) {
    return readFromZip(path, maximumBytes);
  }
  if ((await stat(path)).size > maximumBytes) {
    throw new MultidataFormatError('MULTIDATA_TOO_LARGE', 'The multidata file is too large');
  }
  return new Uint8Array(await readFile(path));
}
