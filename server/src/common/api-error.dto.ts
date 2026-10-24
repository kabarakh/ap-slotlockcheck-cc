import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDto {
  statusCode: number;
  code: string;
  message: string;

  @ApiProperty({ type: Object, required: false })
  details?: Record<string, unknown>;
}
