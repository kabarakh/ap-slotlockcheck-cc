import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AuthUserDto {
  id: number;
  discordId: string;
  name: string;
  username: string;

  @ApiProperty({ type: String, nullable: true })
  avatar: string | null;
}

export class SessionDto {
  @ApiProperty({ type: AuthUserDto, nullable: true })
  user: AuthUserDto | null;
}

export class TestLoginDto {
  @Matches(/^\d{5,20}$/)
  discordId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username: string;
}
