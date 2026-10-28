import { describe, expect, it } from 'vite-plus/test';

import { goalTimeSortKey, statusSortKey } from '../completion-order';
import { slotRow } from './fixtures';

const order = (...slots: ReturnType<typeof slotRow>[]): string[] =>
  [...slots].sort((a, b) => statusSortKey(a) - statusSortKey(b)).map((slot) => slot.name);

describe('statusSortKey', () => {
  it('puts the goaled slots first, then all checks, then incomplete slots', () => {
    expect(
      order(
        slotRow({ name: 'open' }),
        slotRow({ name: 'all checks', completionStatus: 'all_checks' }),
        slotRow({ name: 'released', completionStatus: 'released' }),
        slotRow({ name: 'archipelago goal', archipelagoGoal: true }),
      ),
    ).toEqual(['archipelago goal', 'released', 'all checks', 'open']);
  });

  it('groups the slots without goal by progression, blocked slots first', () => {
    expect(
      order(
        slotRow({ name: 'unknown', progressionStatus: 'unknown' }),
        slotRow({ name: 'go', progressionStatus: 'go' }),
        slotRow({ name: 'bk', progressionStatus: 'bk' }),
        slotRow({ name: 'soft bk', progressionStatus: 'soft_bk' }),
      ),
    ).toEqual(['bk', 'soft bk', 'go', 'unknown']);
  });
});

describe('goalTimeSortKey', () => {
  it('uses the goal time of goaled slots', () => {
    expect(goalTimeSortKey(slotRow({ completionStatus: 'done', goalTime: '2026-10-28T10:00:00Z' }))).toBe(
      '2026-10-28T10:00:00.000Z',
    );
  });

  it('has no key for slots without goal or without known goal time', () => {
    expect(goalTimeSortKey(slotRow({ goalTime: '2026-10-28T10:00:00Z' }))).toBeNull();
    expect(goalTimeSortKey(slotRow({ completionStatus: 'goal' }))).toBeNull();
  });
});
