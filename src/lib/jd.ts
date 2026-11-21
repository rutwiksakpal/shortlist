import { extractTerms, type Term } from './keywords';
import { clean } from './utils';

export interface JdAnalysis {
  jobTitle: string;
  hardSkills: Term[];
  tools: Term[];
  years: string[];
  minYears: number | null;
}

const TITLE_WORDS =
  /\b(developer|engineer|programmer|designer|architect|manager|specialist|analyst|consultant|lead|intern|administrator|strategist|marketer|executive|associate|officer|scientist|expert)\b/i;

function cleanTitle(t: string): string {
  return clean(t)
    .replace(/^(an?|the)\s+/i, '')
    .replace(/[.,:;!].*$/, '')
    .replace(/\s+(to|who|with|for|that|in|at)\s.*$/i, '')
    .trim();
}

export function extractJobTitle(jd: string): string {
  const lines = jd.split(/\r?\n/).map(clean).filter(Boolean);
  for (const line of lines) {
    const m = /^(?:job\s*title|title|position|role|designation)\s*[:-]\s*(.+)$/i.exec(line);
    if (m?.[1]) return cleanTitle(m[1]);
  }
  for (const line of lines.slice(0, 5)) {
    const words = line.split(' ');
    if (words.length <= 8 && TITLE_WORDS.test(line) && !/[.:]$/.test(line)) return cleanTitle(line);
  }
  const m =
    /(?:hiring|looking for|seeking|search of|need)\s+(?:an?\s+|the\s+)?((?:[A-Za-z/+#.-]+\s+){0,4}?(?:developer|engineer|designer|architect|manager|specialist|analyst|consultant|lead|intern|programmer|marketer))/i.exec(
      jd,
    );
  if (m?.[1]) return cleanTitle(m[1]);
  return '';
}

export function extractYears(jd: string): { phrases: string[]; min: number | null } {
  const re =
    /(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*(\d{1,2})\s*)?\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:professional|relevant|hands-on|work|industry))?(?:\s+experience)?/gi;
  const phrases = new Set<string>();
  let min: number | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(jd)) !== null) {
    const a = Number(m[1]);
    if (a > 30) continue;
    phrases.add(clean(m[0]));
    min = min === null ? a : Math.min(min, a);
  }
  return { phrases: Array.from(phrases).slice(0, 5), min };
}

export function analyzeJobDescription(jd: string): JdAnalysis {
  const terms = extractTerms(jd);
  const years = extractYears(jd);
  return {
    jobTitle: extractJobTitle(jd),
    hardSkills: terms.filter((t) => t.kind === 'skill'),
    tools: terms.filter((t) => t.kind === 'tool'),
    years: years.phrases,
    minYears: years.min,
  };
}

export const MIN_JD_LENGTH = 40;

export function hasUsableJd(jd: string): boolean {
  return clean(jd).length >= MIN_JD_LENGTH;
}
