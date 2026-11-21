/**
 * Detects and strips personal data the app must never store or print:
 * date of birth, age, gender, marital status, nationality, religion, photo and full street address.
 */

export interface Removed {
  reason: string;
  text: string;
}

const RULES: Array<{ reason: string; re: RegExp }> = [
  { reason: 'Date of birth', re: /\b(date\s*of\s*birth|d\.?\s?o\.?\s?b\.?|birth\s*date|birthday|born\s+on)\b/i },
  { reason: 'Age', re: /\bage\s*[:\-–]?\s*\d{2}\b|\b\d{2}\s*(years|yrs)\s*old\b/i },
  { reason: 'Gender', re: /\b(gender|sex)\s*[:\-–]|\b(gender)\b/i },
  { reason: 'Marital status', re: /\bmarital\s*status\b|^\s*(married|unmarried)\s*$/i },
  { reason: 'Nationality', re: /\bnationality\b|\bcitizenship\s*[:\-–]/i },
  { reason: 'Religion', re: /\breligion\b|\bcaste\b/i },
  { reason: 'Family details', re: /\b(father|mother|husband|wife|spouse)'?s?\s*name\b/i },
  { reason: 'Street address', re: /^\s*(permanent\s+|current\s+|residential\s+|postal\s+)?address\s*[:\-–]/i },
];

/** Street address heuristics, only applied in the header/contact region and personal-details sections. */
const ADDRESS_RE =
  /(\b\d+[a-z]?\s*[,/-]?\s*.*\b(road|rd\.?|street|st\.?|lane|ln\.?|nagar|marg|flat|apt\.?|apartment|building|bldg\.?|sector|floor|plot|house|chs|society|wing|near|opp\.?|colony|avenue|ave\.?|block|tower)\b)|\b(pin\s*(code)?\s*[:\-–]?\s*)?\d{6}\b|\b[A-Z]{2}\s\d{5}(-\d{4})?\b/i;

const SEGMENT_SPLIT = /\s*(?:\||•|·|●|▪|•|;)\s*/;

export function sensitiveReason(text: string, allowAddress: boolean): string | null {
  for (const r of RULES) if (r.re.test(text)) return r.reason;
  if (allowAddress && ADDRESS_RE.test(text) && !/@|https?:|www\.|linkedin|github/i.test(text)) {
    // Phone numbers contain digit runs; don't mistake them for PIN codes.
    const withoutPhones = text.replace(/\+?\d[\d\s().-]{8,}\d/g, '');
    if (ADDRESS_RE.test(withoutPhones)) return 'Street address';
  }
  return null;
}

/**
 * Strips sensitive data from a line. Lines made of "a | b | c" segments only lose the
 * sensitive segments; everything else is kept.
 */
export function stripSensitiveLine(line: string, allowAddress: boolean): { kept: string; removed: Removed[] } {
  const segments = line.split(SEGMENT_SPLIT).filter((s) => s.trim());
  if (segments.length > 1) {
    const kept: string[] = [];
    const removed: Removed[] = [];
    for (const seg of segments) {
      const reason = sensitiveReason(seg, allowAddress);
      if (reason) removed.push({ reason, text: seg.trim() });
      else kept.push(seg.trim());
    }
    return { kept: kept.join(' | '), removed };
  }
  const reason = sensitiveReason(line, allowAddress);
  return reason ? { kept: '', removed: [{ reason, text: line.trim() }] } : { kept: line, removed: [] };
}

/** Keys in JSON imports that must be dropped. */
export const SENSITIVE_JSON_KEYS =
  /^(dob|dateofbirth|birthdate|birthday|age|gender|sex|maritalstatus|nationality|religion|caste|photo|picture|image|avatar|address|street|streetaddress|postalcode|zip|zipcode)$/i;
