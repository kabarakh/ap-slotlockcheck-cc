import { describe, expect, it } from 'vitest';

import { SLUG_PATTERN, trackerIdFromInput } from '../room-setup';

describe('trackerIdFromInput', () => {
  it('reads the tracker ID from a Cheese link', () => {
    expect(trackerIdFromInput(' https://cheesetrackers.example/tracker/AbCdEfGhIjKlMnOpQrStUv ')).toBe(
      'AbCdEfGhIjKlMnOpQrStUv',
    );
  });

  it('keeps a plain tracker ID', () => {
    expect(trackerIdFromInput('AbCdEfGhIjKlMnOpQrStUv')).toBe('AbCdEfGhIjKlMnOpQrStUv');
  });
});

describe('SLUG_PATTERN', () => {
  it('accepts URL names and rejects others', () => {
    expect(SLUG_PATTERN.test('big-chill-2')).toBe(true);
    expect(SLUG_PATTERN.test('-big')).toBe(false);
    expect(SLUG_PATTERN.test('Big Chill')).toBe(false);
  });
});
