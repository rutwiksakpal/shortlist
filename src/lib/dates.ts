export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const MONTH_LOOKUP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export interface ParsedDate {
  year: number;
  month: number | null;
}

/** Parse stored "YYYY" or "YYYY-MM". */
export function parseStoredDate(value: string): ParsedDate | null {
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : null;
  if (month !== null && (month < 1 || month > 12)) return null;
  return { year, month };
}

export function toStored(year: number, month: number | null): string {
  return month ? `${year}-${String(month).padStart(2, '0')}` : String(year);
}

/** "2023-04" -> "Apr 2023", "2023" -> "2023", "present" -> "Present". */
export function formatDate(value: string): string {
  if (value === 'present') return 'Present';
  const p = parseStoredDate(value);
  if (!p) return '';
  return p.month ? `${MONTHS[p.month - 1]} ${p.year}` : String(p.year);
}

/**
 * "Mon YYYY - Mon YYYY". Only filled parts are joined, never leaving a stray hyphen.
 */
export function formatRange(start: string, end: string): string {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return s === e ? s : `${s} - ${e}`;
  return s || e;
}

function comparable(p: ParsedDate, isEnd: boolean): number {
  const month = p.month ?? (isEnd ? 12 : 1);
  return p.year * 12 + (month - 1);
}

export interface DateRangeIssue {
  field: 'start' | 'end';
  message: string;
}

/** Validates a start/end pair. Returns null when valid. */
export function validateRange(start: string, end: string, now: Date = new Date()): DateRangeIssue | null {
  const currentYear = now.getFullYear();
  if (start) {
    const s = parseStoredDate(start);
    if (!s) return { field: 'start', message: 'Start date is not valid.' };
    if (s.year < 1950 || s.year > currentYear + 1) return { field: 'start', message: 'Start year looks wrong.' };
  }
  if (end && end !== 'present') {
    const e = parseStoredDate(end);
    if (!e) return { field: 'end', message: 'End date is not valid.' };
    if (e.year < 1950 || e.year > currentYear + 10) return { field: 'end', message: 'End year looks wrong.' };
    if (start) {
      const s = parseStoredDate(start);
      if (s && comparable(e, true) < comparable(s, false)) {
        return { field: 'end', message: 'End date must be after the start date.' };
      }
    }
  }
  return null;
}

const RANGE_SEP = String.raw`\s*(?:-|–|—|to|till|until)\s*`;
const MONTH_RE = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const DATE_TOKEN = String.raw`(?:${MONTH_RE}\s*,?\s*\d{4}|\d{1,2}\s*[/.-]\s*\d{4}|\d{4})`;
const END_TOKEN = String.raw`(?:${DATE_TOKEN}|present|current|now|ongoing|today)`;

export const DATE_RANGE_REGEX = new RegExp(String.raw`(${DATE_TOKEN})${RANGE_SEP}(${END_TOKEN})`, 'i');
export const SINGLE_DATE_REGEX = new RegExp(String.raw`(${DATE_TOKEN})`, 'i');

/** Parse free text such as "April 2021", "04/2021", "2021", "Present" into storage form. */
export function parseLooseDate(text: string): string {
  const t = text.trim().toLowerCase().replace(/\.$/, '');
  if (!t) return '';
  if (/^(present|current|now|ongoing|today)$/.test(t)) return 'present';
  let m = /^([a-z]+)\.?\s*,?\s*(\d{4})$/.exec(t);
  if (m) {
    const month = MONTH_LOOKUP[m[1] ?? ''];
    if (month) return toStored(Number(m[2]), month);
  }
  m = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(t);
  if (m) {
    const month = Number(m[1]);
    if (month >= 1 && month <= 12) return toStored(Number(m[2]), month);
  }
  m = /^(\d{4})$/.exec(t);
  if (m) return m[1] ?? '';
  return '';
}

/** Finds a date range in a line. Returns stored values and the line with the range removed. */
export function extractRange(line: string): { start: string; end: string; rest: string } | null {
  const m = DATE_RANGE_REGEX.exec(line);
  if (m) {
    return {
      start: parseLooseDate(m[1] ?? ''),
      end: parseLooseDate(m[2] ?? ''),
      rest: (line.slice(0, m.index) + line.slice(m.index + m[0].length))
        .replace(/[|,–—-]\s*$/, '')
        .replace(/\s*[|•·]\s*$/, '')
        .trim(),
    };
  }
  return null;
}

/** Years list for selects, newest first. */
export function yearOptions(now: Date = new Date()): number[] {
  const years: number[] = [];
  for (let y = now.getFullYear() + 6; y >= 1970; y -= 1) years.push(y);
  return years;
}

/** Number of months between two stored dates (end may be "present"). */
export function monthsBetween(start: string, end: string, now: Date = new Date()): number | null {
  const s = parseStoredDate(start);
  if (!s) return null;
  const e = end === 'present' ? { year: now.getFullYear(), month: now.getMonth() + 1 } : parseStoredDate(end);
  if (!e) return null;
  return comparable(e, true) - comparable(s, false) + 1;
}
