import { Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';
import { AppConfigService } from '../../config/app-config.service.js';
import { SourceFormatError, SourceRequestError } from './source-errors.js';

@Injectable()
export class SourceHttpService {
  private readonly logger = new Logger(SourceHttpService.name);

  constructor(private readonly config: AppConfigService) {}

  async getJson<Schema extends z.ZodType>(url: string, schema: Schema): Promise<z.output<Schema>> {
    const body = await this.fetchJson(url);
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new SourceFormatError(
        url,
        result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
      );
    }
    return result.data;
  }

  async getRawJson(url: string): Promise<unknown> {
    return this.fetchJson(url);
  }

  async visit(url: string): Promise<void> {
    const response = await this.request(url, 'text/html');
    await response.arrayBuffer();
  }

  private async request(url: string, accept: string): Promise<Response> {
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept, 'user-agent': this.config.get('HTTP_USER_AGENT') },
        signal: AbortSignal.timeout(this.config.get('HTTP_TIMEOUT_SECONDS') * 1000),
      });
    } catch (error) {
      this.logger.warn(`GET ${url} failed after ${this.elapsed(startedAt)} ms`);
      throw new SourceRequestError(url, undefined, error instanceof Error ? error.message : String(error));
    }
    this.logger.log(`GET ${url} ${response.status} ${this.elapsed(startedAt)} ms`);
    if (!response.ok) {
      throw new SourceRequestError(url, response.status, `HTTP ${response.status}`);
    }
    return response;
  }

  private async fetchJson(url: string): Promise<unknown> {
    const response = await this.request(url, 'application/json');
    try {
      return await response.json();
    } catch {
      throw new SourceFormatError(url, ['body is not valid JSON']);
    }
  }

  private elapsed(startedAt: number): number {
    return Math.round(performance.now() - startedAt);
  }
}
