import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ICO_HEADER_SIZE = 6;
const ICO_ENTRY_SIZE = 16;
const ICO_SIZES = [16, 32, 48];

const publicDirectory = join(import.meta.dirname, '..', 'public');

export function renderPng(svg: string, size: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

export function createIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(ICO_HEADER_SIZE);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = ICO_HEADER_SIZE + ICO_ENTRY_SIZE * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(ICO_ENTRY_SIZE);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

function writeIcons(): void {
  const favicon = readFileSync(join(publicDirectory, 'favicon.svg'), 'utf8');
  const logo = readFileSync(join(publicDirectory, 'logo.svg'), 'utf8');
  writeFileSync(
    join(publicDirectory, 'favicon.ico'),
    createIco(ICO_SIZES.map((size) => ({ size, png: renderPng(favicon, size) }))),
  );
  writeFileSync(join(publicDirectory, 'favicon-32.png'), renderPng(favicon, 32));
  writeFileSync(join(publicDirectory, 'apple-touch-icon.png'), renderPng(logo, 180));
  writeFileSync(join(publicDirectory, 'logo-512.png'), renderPng(logo, 512));
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  writeIcons();
}
