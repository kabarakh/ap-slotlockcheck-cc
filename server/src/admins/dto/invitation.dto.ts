import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { ADMIN_ROLES, type AdminRole } from './admins.dto.js';

export class CreateInvitationDto {
  @ApiProperty({ enum: ADMIN_ROLES, enumName: 'AdminRole', required: false })
  @IsOptional()
  @IsIn(ADMIN_ROLES)
  role?: AdminRole;
}

export class AdminInvitationDto {
  url: string;
  validUntil: string;

  @ApiProperty({ enum: ADMIN_ROLES, enumName: 'AdminRole' })
  role: AdminRole;
}

export class AcceptedInvitationDto {
  slug: string;
}
