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

export class SeedUploadDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: unknown;
}
