import { compressSnapshotPayload, snapshotHash, snapshotPayloadText } from './snapshot-payload.js';

describe('snapshotHash', () => {
  it('ignores the update time of the cheese tracker', () => {
    const first = { title: 'Room', updated_at: '2026-11-05T10:00:00Z', games: [{ id: 1 }] };
    const second = { ...first, updated_at: '2026-11-05T10:05:00Z' };
    expect(snapshotHash('cheese', second)).toBe(snapshotHash('cheese', first));
  });

  it('sees a change of the cheese games', () => {
    const first = { updated_at: '2026-11-05T10:00:00Z', games: [{ id: 1 }] };
    const second = { updated_at: '2026-11-05T10:00:00Z', games: [{ id: 2 }] };
    expect(snapshotHash('cheese', second)).not.toBe(snapshotHash('cheese', first));
  });

  it('uses the update time in the other sources', () => {
    const first = { updated_at: '2026-11-05T10:00:00Z' };
    const second = { updated_at: '2026-11-05T10:05:00Z' };
    expect(snapshotHash('ap_tracker', second)).not.toBe(snapshotHash('ap_tracker', first));
  });
});

describe('snapshotPayloadText', () => {
  it('gives the text of a compressed payload', async () => {
    const json = JSON.stringify({ player_items_received: [{ player: 1, items: [[1, 2, 3, 1]] }] });
    const compressedPayload = await compressSnapshotPayload(json);
    expect(await snapshotPayloadText({ payload: null, compressedPayload })).toBe(json);
  });

  it('prefers a payload that is not compressed', async () => {
    const compressedPayload = await compressSnapshotPayload('{"a":1}');
    expect(await snapshotPayloadText({ payload: '{"b":2}', compressedPayload })).toBe('{"b":2}');
  });

  it('gives an empty text without a payload', async () => {
    expect(await snapshotPayloadText({ payload: null, compressedPayload: null })).toBe('');
  });
});
