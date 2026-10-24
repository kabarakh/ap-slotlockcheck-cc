import { loadFixture } from '../../test/fixtures/fixtures.js';
import { cheeseTrackerSchema, type CheeseTracker } from '../sources/cheese/cheese.schemas.js';
import { checkTrackerOwner, slugFromTitle } from './owner-check.js';

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
