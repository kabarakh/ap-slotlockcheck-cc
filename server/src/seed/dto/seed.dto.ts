import { ApiProperty } from '@nestjs/swagger';

export class SeedDataDto {
  seedName: string;
  archipelagoVersion: string;
  locationCount: number;
  sphereCount: number;
  unreachableLocationCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  uploadedAt: string;

  uploadedByName: string;
}

export class SeedComparisonDto {
  @ApiProperty({ type: String, nullable: true })
  uploadedSeedName: string | null;

  @ApiProperty({ type: String, nullable: true })
  serverSeedName: string | null;

  @ApiProperty({ type: String, nullable: true })
  serverError: string | null;

  @ApiProperty({ type: Boolean, nullable: true })
  matches: boolean | null;
}

export class SeedUploadDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: unknown;
}
