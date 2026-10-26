import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class TransferOwnerDto {
  @Matches(/^\d{5,20}$/)
  discordId: string;

  @IsBoolean()
  stayAdmin: boolean;
}

export class DeleteRoomDto {
  @IsString()
  @MaxLength(200)
  title: string;
}
