import { loadFixture } from '../../test/fixtures/fixtures.js';
import { cheeseTrackerSchema, type CheeseTracker } from '../sources/cheese/cheese.schemas.js';
import { checkTrackerOwner, slugFromTitle, trackerOwnerIdentity } from './owner-check.js';

const tracker = cheeseTrackerSchema.parse(loadFixture('cheese-tracker'));

describe('checkTrackerOwner', () => {
  it('confirms the owner through a claimed slot', () => {
    expect(checkTrackerOwner(tracker, { discordId: '100000000000000001', username: 'other' })).toBe('slot');
  });

  it('rejects another user if the owner has a claimed slot', () => {
    expect(checkTrackerOwner(tracker, { discordId: '100000000000000002', username: 'alice_owner' })).toBe('failed');
  });

  it('uses the user name if the owner has no claimed slot', () => {
    const withoutSlot: CheeseTracker = {
      ...tracker,
      games: tracker.games.map((game) => ({ ...game, claimed_by_ct_user_id: undefined })),
    };
    expect(checkTrackerOwner(withoutSlot, { discordId: '1', username: 'Alice_Owner' })).toBe('name');
    expect(checkTrackerOwner(withoutSlot, { discordId: '1', username: 'bob' })).toBe('failed');
  });

  it('fails without owner information', () => {
    const withoutOwner: CheeseTracker = { ...tracker, owner_ct_user_id: undefined, owner_discord_username: undefined };
    expect(checkTrackerOwner(withoutOwner, { discordId: '100000000000000001', username: 'alice_owner' })).toBe(
      'failed',
    );
  });
});

describe('slugFromTitle', () => {
  it('makes a URL-safe slug', () => {
    expect(slugFromTitle('The Big Chill!')).toBe('the-big-chill');
    expect(slugFromTitle('Café Ärger')).toBe('cafe-arger');
    expect(slugFromTitle('***')).toBe('room');
  });
});

describe('trackerOwnerIdentity', () => {
  it('uses the Discord user of the claimed slots of the owner', () => {
    expect(trackerOwnerIdentity(tracker)).toEqual({ discordId: '100000000000000001' });
  });

  it('uses the Discord name of the owner without a claimed slot', () => {
    expect(trackerOwnerIdentity({ ...tracker, owner_ct_user_id: 999 })).toEqual({ username: 'alice_owner' });
    expect(trackerOwnerIdentity({ ...tracker, owner_ct_user_id: undefined })).toEqual({ username: 'alice_owner' });
  });

  it('gives no identity when it is not clear', () => {
    const games = tracker.games.map((game, index) =>
      index === 0 ? { ...game, claimed_by_ct_user_id: 7, effective_discord_user_id: '100000000000000099' } : game,
    );
    expect(trackerOwnerIdentity({ ...tracker, games })).toBeNull();
    expect(trackerOwnerIdentity({ ...tracker, owner_ct_user_id: 999, owner_discord_username: undefined })).toBeNull();
  });
});
