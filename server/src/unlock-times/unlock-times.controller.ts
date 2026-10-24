import { Body, Controller, HttpCode, Param, Post, Put } from '@nestjs/common';
import { RequireRoomRole } from '../auth/auth.decorators.js';
import { ImportUnlockTimesDto, SetUnlockTimeDto, UnlockTimeImportResultDto } from './dto/unlock-time.dto.js';
import { UnlockTimesService } from './unlock-times.service.js';

@Controller('rooms/:slug/unlock-times')
@RequireRoomRole('admin')
export class UnlockTimesController {
  constructor(private readonly unlockTimes: UnlockTimesService) {}

  @Put()
  @HttpCode(204)
  set(@Param('slug') slug: string, @Body() body: SetUnlockTimeDto): Promise<void> {
    return this.unlockTimes.setManual(slug, body);
  }

  @Post('csv')
  @HttpCode(200)
  importCsv(@Param('slug') slug: string, @Body() body: ImportUnlockTimesDto): Promise<UnlockTimeImportResultDto> {
    return this.unlockTimes.importCsv(slug, body.csv);
  }
}
