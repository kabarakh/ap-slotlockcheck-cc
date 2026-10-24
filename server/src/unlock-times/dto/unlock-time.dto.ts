import { IsDateString, IsInt, IsString, MaxLength } from 'class-validator';

export class SetUnlockTimeDto {
  @IsInt()
  lockerSlotId: number;

  @IsInt()
  lockedSlotId: number;

  @IsDateString()
  unlockTime: string;
}

export class ImportUnlockTimesDto {
  @IsString()
  @MaxLength(1_000_000)
  csv: string;
}

export class UnlockTimeImportResultDto {
  updated: number;
  errors: string[];
}
