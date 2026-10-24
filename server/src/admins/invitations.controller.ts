import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, RequireLogin, RequireRoomRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AcceptedInvitationDto, AdminInvitationDto } from './dto/invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('rooms/:slug/invitations')
  @RequireRoomRole('admin')
  create(@Param('slug') slug: string, @CurrentUser() admin: AuthUser): Promise<AdminInvitationDto> {
    return this.invitations.create(slug, admin);
  }

  @Post('invitations/:token/accept')
  @HttpCode(200)
  @RequireLogin()
  accept(@Param('token') token: string, @CurrentUser() user: AuthUser): Promise<AcceptedInvitationDto> {
    return this.invitations.accept(token, user);
  }
}
