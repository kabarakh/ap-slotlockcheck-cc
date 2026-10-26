import { join } from 'node:path';
import { Module, type DynamicModule, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AdminsModule } from './admins/admins.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ApiErrorFilter } from './common/api-error.filter.js';
import { OriginCheckMiddleware } from './common/origin-check.middleware.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { LiveModule } from './live/live.module.js';
import { LockModule } from './lock/lock.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RoomSetupModule } from './room-setup/room-setup.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { SyncModule } from './sync/sync.module.js';
import { UnlockTimesModule } from './unlock-times/unlock-times.module.js';
import { WarningsModule } from './warnings/warnings.module.js';
import { SeedModule } from './seed/seed.module.js';
import { LocationsModule } from './locations/locations.module.js';

function staticAppModules(): DynamicModule[] {
  const appDistPath = process.env.APP_DIST_PATH ?? join(import.meta.dirname, '..', '..', 'app', 'dist');
  return [ServeStaticModule.forRoot({ rootPath: appDistPath, exclude: ['/api/{*path}', '/socket.io/{*path}'] })];
}

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
    ...staticAppModules(),
    AuthModule,
    LockModule,
    RoomsModule,
    LiveModule,
    SyncModule,
    RoomSetupModule,
    AdminsModule,
    WarningsModule,
    UnlockTimesModule,
    HealthModule,
    SeedModule,
    LocationsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiErrorFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginCheckMiddleware).forRoutes('*');
  }
}
