import { parse } from 'csv-parse/sync';

export interface UnlockTimeCsvRow {
  line: number;
  slot: string;
  locker: string | null;
  unlockTime: Date;
}

export interface UnlockTimeCsvResult {
  rows: UnlockTimeCsvRow[];
  errors: string[];
}

const SIMPLE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/;

export function parseCsvTime(value: string): Date | undefined {
  const trimmed = value.trim();
  const simple = SIMPLE_TIME_PATTERN.exec(trimmed);
  const candidate = simple ? `${simple[1]}T${simple[2]}${simple[3] ?? ':00'}Z` : trimmed;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function parseUnlockTimeCsv(csv: string): UnlockTimeCsvResult {
  let records: Record<string, string>[];
  try {
    records = parse(csv, {
      columns: (header: string[]) => header.map((column) => column.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      delimiter: [',', ';'],
    });
  } catch (error) {
    return { rows: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
  const rows: UnlockTimeCsvRow[] = [];
  const errors: string[] = [];
  records.forEach((record, index) => {
    const line = index + 2;
    const slot = record['slot']?.trim();
    const time = record['unlock_time'];
    if (!slot || time === undefined) {
      errors.push(`Line ${line}: columns "slot" and "unlock_time" are necessary`);
      return;
    }
    const unlockTime = parseCsvTime(time);
    if (!unlockTime) {
      errors.push(`Line ${line}: "${time}" is not a valid time`);
      return;
    }
    const locker = record['locker']?.trim();
    rows.push({ line, slot, locker: locker ? locker : null, unlockTime });
  });
  return { rows, errors };
}
