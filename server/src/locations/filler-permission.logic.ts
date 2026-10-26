import { RoomRoleService } from '../auth/room-role.service.js';
import type { RoomRole } from '../rooms/dto/room.dto.js';

export interface FillerPermissionInput {
  role: RoomRole;
  playersMarkFiller: boolean;
  isOwnSlot: boolean;
  checked: boolean;
}

export function canMarkFiller(input: FillerPermissionInput): boolean {
  if (input.checked) {
    return false;
  }
  if (RoomRoleService.satisfies(input.role, 'helper')) {
    return true;
  }
  return input.role === 'player' && input.playersMarkFiller && input.isOwnSlot;
}
