import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vite-plus/test';

import { SLUG_PATTERN, trackerIdFromInput, useRoomSetupStore } from '../room-setup';

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

describe('useRoomSetupStore', () => {
  it('creates a room without a selected SlotLock slot', () => {
    setActivePinia(createPinia());
    const setup = useRoomSetupStore();
    setup.preview = {
      cheeseTrackerId: 'AbCdEfGhIjKlMnOpQrStUv',
      title: 'Big Chill',
      suggestedSlug: 'big-chill',
      ownerCheck: 'slot',
      ownerDiscordName: 'alice',
      existingSlug: null,
      slotLockSlots: [],
    };
    setup.title = 'Big Chill';
    setup.slug = 'big-chill';
    setup.slotLockPositions = [];
    expect(setup.canCreate).toBe(true);
  });
});
