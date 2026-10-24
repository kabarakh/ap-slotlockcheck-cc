import { IsDateString, IsInt, IsString, MaxLength, MinLength } from 'class-validator';

export class WarningDto {
  id: number;
  slotId: number;
  slotName: string;
  adminName: string;
  date: string;
  text: string;
}

export class CreateWarningDto {
  @IsInt()
  slotId: number;

  @IsDateString()
  date: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
