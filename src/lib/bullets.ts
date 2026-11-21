import { stripBulletPrefix } from './text';
import { clean } from './utils';

/** Strong past-tense action verbs. Present-tense forms are derived for current roles. */
export const ACTION_VERBS = [
  'accelerated',
  'achieved',
  'added',
  'analyzed',
  'analysed',
  'architected',
  'audited',
  'automated',
  'boosted',
  'built',
  'championed',
  'cleaned',
  'coded',
  'collaborated',
  'configured',
  'consolidated',
  'converted',
  'coordinated',
  'created',
  'cut',
  'debugged',
  'decreased',
  'defined',
  'delivered',
  'deployed',
  'designed',
  'developed',
  'diagnosed',
  'documented',
  'doubled',
  'drove',
  'eliminated',
  'enabled',
  'engineered',
  'enhanced',
  'established',
  'executed',
  'expanded',
  'extended',
  'facilitated',
  'fixed',
  'founded',
  'generated',
  'grew',
  'guided',
  'halved',
  'handled',
  'identified',
  'implemented',
  'improved',
  'increased',
  'initiated',
  'innovated',
  'installed',
  'integrated',
  'introduced',
  'launched',
  'led',
  'leveraged',
  'maintained',
  'managed',
  'mentored',
  'merged',
  'migrated',
  'modernized',
  'modernised',
  'monitored',
  'negotiated',
  'optimized',
  'optimised',
  'orchestrated',
  'organized',
  'overhauled',
  'owned',
  'partnered',
  'pioneered',
  'planned',
  'produced',
  'programmed',
  'prototyped',
  'published',
  'raised',
  'ran',
  'rebuilt',
  'recovered',
  'redesigned',
  'reduced',
  'refactored',
  'released',
  'removed',
  'replaced',
  'resolved',
  'restructured',
  'revamped',
  'saved',
  'scaled',
  'secured',
  'set',
  'shipped',
  'simplified',
  'solved',
  'spearheaded',
  'standardized',
  'standardised',
  'streamlined',
  'strengthened',
  'structured',
  'supported',
  'tested',
  'trained',
  'transformed',
  'translated',
  'tripled',
  'troubleshot',
  'tuned',
  'unified',
  'upgraded',
  'validated',
  'wrote',
];

const IRREGULAR_PRESENT: Record<string, string> = {
  built: 'build',
  cut: 'cut',
  drove: 'drive',
  grew: 'grow',
  led: 'lead',
  ran: 'run',
  set: 'set',
  wrote: 'write',
  troubleshot: 'troubleshoot',
  halved: 'halve',
};

function presentForm(past: string): string[] {
  const irregular = IRREGULAR_PRESENT[past];
  if (irregular) return [irregular, `${irregular}s`];
  const forms = new Set<string>();
  if (past.endsWith('ied')) {
    const base = `${past.slice(0, -3)}y`;
    forms.add(base);
    forms.add(`${past.slice(0, -3)}ies`);
  } else if (past.endsWith('ed')) {
    const stem = past.slice(0, -2);
    const stemE = past.slice(0, -1);
    forms.add(stem);
    forms.add(stemE);
    forms.add(`${stem}s`);
    forms.add(`${stemE}s`);
    if (/([bdgklmnprt])\1$/.test(stem)) forms.add(stem.slice(0, -1));
  }
  return Array.from(forms);
}

const PAST_SET = new Set(ACTION_VERBS);
const PRESENT_SET = new Set(ACTION_VERBS.flatMap(presentForm));

/** Weak openers that hide impact. */
const WEAK_OPENERS = ['responsible', 'worked', 'helped', 'assisted', 'involved', 'participated', 'tasked', 'duties', 'handled various'];

export function firstWord(text: string): string {
  const t = stripBulletPrefix(clean(text)).toLowerCase();
  const m = /^[a-z][a-z-]*/.exec(t);
  return m ? m[0] : '';
}

export function startsWithActionVerb(text: string): boolean {
  const w = firstWord(text);
  if (!w || WEAK_OPENERS.includes(w)) return false;
  return PAST_SET.has(w) || PRESENT_SET.has(w);
}

export function isPresentTenseVerb(text: string): boolean {
  const w = firstWord(text);
  return Boolean(w) && PRESENT_SET.has(w) && !PAST_SET.has(w);
}

export function isPastTenseVerb(text: string): boolean {
  return PAST_SET.has(firstWord(text));
}

/** Numbers, percentages, currency, multipliers, durations. */
export function hasMetric(text: string): boolean {
  return /(\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|dozens?|hundreds?|thousands?|millions?)\b)/i.test(text);
}

/** Roughly two printed lines at 10.5pt on A4 with 0.7in margins. */
export const MAX_BULLET_CHARS = 190;
export const MIN_BULLET_CHARS = 35;

export type BulletIssue =
  | { kind: 'verb'; message: string }
  | { kind: 'metric'; message: string }
  | { kind: 'long'; message: string }
  | { kind: 'short'; message: string }
  | { kind: 'weak'; message: string };

/**
 * Suggestions only. Never rewrites the bullet or invents numbers.
 */
export function analyzeBullet(text: string): BulletIssue[] {
  const t = stripBulletPrefix(clean(text));
  if (!t) return [];
  const issues: BulletIssue[] = [];
  const w = firstWord(t);
  if (WEAK_OPENERS.includes(w)) {
    issues.push({ kind: 'weak', message: `"${w}" is a weak opener. Start with what you did, e.g. "Built", "Reduced", "Led".` });
  } else if (!startsWithActionVerb(t)) {
    issues.push({ kind: 'verb', message: 'Start with an action verb, e.g. "Built", "Optimized", "Launched".' });
  }
  if (!hasMetric(t)) {
    issues.push({ kind: 'metric', message: 'No number found. Add a real metric if you have one (%, time saved, users, revenue).' });
  }
  if (t.length > MAX_BULLET_CHARS) {
    issues.push({ kind: 'long', message: `About ${Math.ceil(t.length / 95)} lines long. Keep bullets to 2 lines or less.` });
  } else if (t.length < MIN_BULLET_CHARS) {
    issues.push({ kind: 'short', message: 'Very short. Add what you did and the result.' });
  }
  return issues;
}
