import createClient from 'openapi-fetch';

import type { paths } from './schema';
import type { ApiError } from './types';

export const api = createClient<paths>({ baseUrl: '', credentials: 'same-origin' });

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface FetchResult<Data> {
  data?: Data;
  error?: unknown;
  response: Response;
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value;
}

export async function unwrap<Data>(request: Promise<FetchResult<Data>>): Promise<Data> {
  const { data, error, response } = await request;
  if (!response.ok) {
    if (isApiError(error)) {
      throw new ApiRequestError(response.status, error.code, error.message, error.details);
    }
    throw new ApiRequestError(response.status, 'HTTP_ERROR', `HTTP ${response.status}`);
  }
  return data as Data;
}
