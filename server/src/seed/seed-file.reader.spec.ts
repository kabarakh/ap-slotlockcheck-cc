import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { multidataFixturePath } from '../../test/fixtures/fixtures.js';
import { MultidataFormatError } from './multidata.reader.js';
import { readSeedFile } from './seed-file.reader.js';

const fixture = (name: string): string => join(import.meta.dirname, '..', '..', 'test', 'fixtures', name);

const expectCode = async (action: Promise<unknown>, code: string) => {
  const error: unknown = await action.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(MultidataFormatError);
  expect((error as MultidataFormatError).code).toBe(code);
};

describe('readSeedFile', () => {
  const multidata = new Uint8Array(readFileSync(multidataFixturePath('big-chill')));
  let directory: string;

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), 'slotlock-seed-file-'));
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('reads a multidata file', async () => {
    await expect(readSeedFile(multidataFixturePath('big-chill'))).resolves.toEqual(multidata);
  });

  it('reads only the multidata file from the generation output', async () => {
    await expect(readSeedFile(fixture('generation-big-chill.zip'))).resolves.toEqual(multidata);
  });

  it('rejects a ZIP file without or with more than one multidata file', async () => {
    await expectCode(readSeedFile(fixture('generation-without-multidata.zip')), 'ZIP_WITHOUT_MULTIDATA');
    await expectCode(readSeedFile(fixture('generation-two-multidata.zip')), 'ZIP_WITH_MORE_MULTIDATA');
  });

  it('rejects a broken ZIP file', async () => {
    const path = join(directory, 'broken.zip');
    writeFileSync(path, Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
    await expectCode(readSeedFile(path), 'INVALID_ZIP');
  });

  it('rejects files that are too large', async () => {
    await expectCode(readSeedFile(multidataFixturePath('big-chill'), 100), 'MULTIDATA_TOO_LARGE');
    await expectCode(readSeedFile(fixture('generation-big-chill.zip'), 100), 'MULTIDATA_TOO_LARGE');
  });
});
