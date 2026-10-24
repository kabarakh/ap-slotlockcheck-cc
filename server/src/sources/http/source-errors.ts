export class SourceRequestError extends Error {
  constructor(
    readonly url: string,
    readonly status: number | undefined,
    reason: string,
  ) {
    super(`Request to ${url} failed: ${reason}`);
    this.name = 'SourceRequestError';
  }
}

export class SourceFormatError extends Error {
  constructor(
    readonly url: string,
    readonly issues: string[],
  ) {
    super(`Unexpected response format from ${url}: ${issues.join('; ')}`);
    this.name = 'SourceFormatError';
  }
}
