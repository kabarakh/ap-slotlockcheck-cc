import type { CheeseTracker } from '../sources/cheese/cheese.schemas.js';

export type OwnerCheckResult = 'slot' | 'name' | 'failed';

export interface OwnerCandidate {
  discordId: string;
  username: string;
}

export function checkTrackerOwner(tracker: CheeseTracker, candidate: OwnerCandidate): OwnerCheckResult {
  const ownerId = tracker.owner_ct_user_id;
  if (ownerId !== undefined) {
    const ownerSlots = tracker.games.filter(
      (game) => game.claimed_by_ct_user_id === ownerId && game.effective_discord_user_id !== undefined,
    );
    if (ownerSlots.length > 0) {
      return ownerSlots.some((game) => game.effective_discord_user_id === candidate.discordId) ? 'slot' : 'failed';
    }
  }
  const ownerName = tracker.owner_discord_username?.trim().toLocaleLowerCase('en');
  if (ownerName && ownerName === candidate.username.trim().toLocaleLowerCase('en')) {
    return 'name';
  }
  return 'failed';
}

export function slugFromTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'room';
}
