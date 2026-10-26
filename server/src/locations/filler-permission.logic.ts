import { RoomRoleService } from '../auth/room-role.service.js';
import type { RoomRole } from '../rooms/dto/room.dto.js';

export interface FillerPermissionInput {
  role: RoomRole;
  playersMarkFiller: boolean;
  isOwnSlot: boolean;
  checked: boolean;
}

export function canChangeFillerMark(input: Omit<FillerPermissionInput, 'checked'>): boolean {
  if (RoomRoleService.satisfies(input.role, 'helper')) {
    return true;
  }
  return input.role === 'player' && input.playersMarkFiller && input.isOwnSlot;
}

export function canMarkFiller(input: FillerPermissionInput): boolean {
  return !input.checked && canChangeFillerMark(input);
}
