import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Min, MinLength, validateSync } from 'class-validator';

const PLACEHOLDER_PATTERN = /<[^>]+>/;

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';
const toInteger = ({ value }: { value: unknown }) => (value === undefined ? undefined : Number(value));

export class Environment {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Transform(toInteger)
  @IsInt()
  PORT = 3000;

  @IsUrl({ require_tld: false })
  PUBLIC_BASE_URL: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  DISCORD_CLIENT_ID: string;

  @IsString()
  DISCORD_CLIENT_SECRET: string;

  @IsUrl({ require_tld: false })
  DISCORD_CALLBACK_URL: string;

  @IsUrl({ require_tld: false })
  CHEESE_BASE_URL = 'https://cheesetrackers.theincrediblewheelofchee.se';

  @IsString()
  HTTP_USER_AGENT: string;

  @Transform(toInteger)
  @IsInt()
  @Min(5)
  SYNC_INTERVAL_MINUTES = 5;

  @Transform(toInteger)
  @IsInt()
  @Min(60)
  MANUAL_SYNC_COOLDOWN_SECONDS = 60;

  @Transform(toInteger)
  @IsInt()
  @Min(1)
  HTTP_TIMEOUT_SECONDS = 30;

  @IsOptional()
  @IsString()
  APP_DIST_PATH?: string;

  @Transform(toBoolean)
  @IsBoolean()
  TRUST_PROXY = false;
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, config, { exposeDefaultValues: true });
  const errors = validateSync(environment, { skipMissingProperties: false });
  const placeholders = Object.entries(config)
    .filter(([key, value]) => key in environment && typeof value === 'string' && PLACEHOLDER_PATTERN.test(value))
    .map(([key]) => `${key} contains a placeholder`);
  const messages = [...errors.flatMap((error) => Object.values(error.constraints ?? {})), ...placeholders];
  if (messages.length > 0) {
    throw new Error(`Invalid environment: ${messages.join('; ')}`);
  }
  return environment;
}
