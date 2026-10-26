import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { ApiErrorDto } from './common/api-error.dto.js';
import {
  LiveMessageCatalogDto,
  LocationsChangedPayloadDto,
  RoomSyncedPayloadDto,
  RoomSyncFailedPayloadDto,
  RoomUpdatedPayloadDto,
} from './live/dto/live-messages.dto.js';

export const API_PREFIX = 'api';

export function configureApp(app: NestExpressApplication, trustProxy: boolean): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  if (trustProxy) {
    app.set('trust proxy', 1);
  }
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('Slotlock Tracker API').setVersion('0.1.0').build();
  return SwaggerModule.createDocument(app, config, {
    extraModels: [
      ApiErrorDto,
      LiveMessageCatalogDto,
      LocationsChangedPayloadDto,
      RoomSyncedPayloadDto,
      RoomSyncFailedPayloadDto,
      RoomUpdatedPayloadDto,
    ],
    operationIdFactory: (_controllerKey, methodKey, version) =>
      version ? `${methodKey}${version}` : `${_controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });
}
