import { databaseDirectory, databaseFile } from './database-directory.logic.js';

describe('databaseDirectory', () => {
  it('gives the directory of a relative or absolute database file', () => {
    expect(databaseDirectory('file:./data/development.db')).toBe('./data');
    expect(databaseDirectory('file:/home/slotlock/shared/data/slotlock.db')).toBe('/home/slotlock/shared/data');
    expect(databaseDirectory('file:./data/development.db?mode=rwc')).toBe('./data');
  });

  it('gives no directory for an in-memory database', () => {
    expect(databaseDirectory('file::memory:')).toBeNull();
    expect(databaseDirectory(':memory:')).toBeNull();
  });
});

describe('databaseFile', () => {
  it('gives the database file without the parameters', () => {
    expect(databaseFile('file:./data/development.db?mode=rwc')).toBe('./data/development.db');
    expect(databaseFile('file:/home/slotlock/shared/data/slotlock.db')).toBe('/home/slotlock/shared/data/slotlock.db');
  });

  it('gives no file for an in-memory database', () => {
    expect(databaseFile('file::memory:')).toBeNull();
  });
});
