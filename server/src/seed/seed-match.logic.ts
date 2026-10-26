import type { MultidataPlayer } from './multidata.reader.js';

export interface RoomSlotIdentity {
  position: number;
  name: string;
  archipelagoName: string | null;
  game: string;
}

export function seedDifferences(slots: RoomSlotIdentity[], players: MultidataPlayer[]): string[] {
  const differences: string[] = [];
  const playersByNumber = new Map(players.map((player) => [player.number, player]));
  for (const slot of [...slots].sort((a, b) => a.position - b.position)) {
    const expectedName = slot.archipelagoName ?? slot.name;
    const player = playersByNumber.get(slot.position);
    if (!player) {
      differences.push(`#${slot.position} ${expectedName}: missing in the file`);
    } else if (player.name !== expectedName || player.game !== slot.game) {
      differences.push(`#${slot.position} ${expectedName} (${slot.game}): ${player.name} (${player.game}) in the file`);
    }
  }
  const positions = new Set(slots.map((slot) => slot.position));
  for (const player of players.filter((candidate) => !positions.has(candidate.number))) {
    differences.push(`#${player.number} ${player.name} (${player.game}): missing in the room`);
  }
  return differences;
}
