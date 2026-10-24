import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { RoomRole } from '../rooms/dto/room.dto.js';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

export const REQUIRE_LOGIN_KEY = 'requireLogin';
export const REQUIRE_ROOM_ROLE_KEY = 'requireRoomRole';

export const RequireLogin = () => SetMetadata(REQUIRE_LOGIN_KEY, true);

export const RequireRoomRole = (role: Exclude<RoomRole, 'visitor'>) => SetMetadata(REQUIRE_ROOM_ROLE_KEY, role);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
