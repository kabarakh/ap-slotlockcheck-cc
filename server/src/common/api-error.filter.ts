import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { SourceFormatError, SourceRequestError } from '../sources/http/source-errors.js';

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

function codeFromMessage(message: string): string {
  return /^[A-Z][A-Z0-9_]+$/.test(message) ? message : 'ERROR';
}

export function toApiError(exception: unknown): ApiErrorBody {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const body = typeof response === 'string' ? { message: response } : (response as Record<string, unknown>);
    const rawMessage = body['message'];
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : exception.message;
    const { message: _message, statusCode: _statusCode, error: _error, ...details } = body;
    return {
      statusCode: exception.getStatus(),
      code: Array.isArray(rawMessage) ? 'VALIDATION_FAILED' : codeFromMessage(message),
      message,
      ...(Object.keys(details).length > 0 ? { details } : {}),
    };
  }
  if (exception instanceof SourceRequestError || exception instanceof SourceFormatError) {
    return { statusCode: HttpStatus.BAD_GATEWAY, code: 'SOURCE_UNAVAILABLE', message: exception.message };
  }
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: 'INTERNAL_ERROR', message: 'Internal server error' };
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toApiError(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
