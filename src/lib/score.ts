import { analyzeBullet, hasMetric, isPresentTenseVerb, MAX_BULLET_CHARS, startsWithActionVerb } from './bullets';
import { validateRange } from './dates';
import { analyzeJobDescription, hasUsableJd, type JdAnalysis } from './jd';
import { countTerm, customTerm, findTerm, hasTerm, presetById, type Term } from './keywords';
import { printedBullets, resumePlainText, type ResolvedResume } from './resolve';
import type { Profile, Variant } from './schema';
import { sanitizeDetailed } from './text';
import { clean, wordCount } from './utils';
import { isValidEmail, isValidPhone, isValidUrl } from './validation';
import type { VerifyResult } from './pdf/verify';

export interface ScoreItem {
  label: string;
  ok: boolean;
  points: number;
  max: number;
  fix?: string;
}

export interface ScoreCategory {
  id: 'format' | 'keywords' | 'sections' | 'bullets' | 'contact' | 'length' | 'consistency';
  label: string;
  score: number;
  max: number;
  items: ScoreItem[];
}

export interface MissingKeyword {
  term: string;
  /** In the master profile but hidden in this resume: safe to suggest showing it. */
  inProfile: boolean;
  /** An umbrella term already listed that implies this one (e.g. MERN). */
  impliedBy?: string;
}

export interface KeywordReport {
  source: 'job' | 'role';
  sourceLabel: string;
  matched: string[];
  missing: MissingKeyword[];
  stuffed: Array<{ term: string; count: number }>;
}

export interface ScoreResult {
  total: number;
  categories: ScoreCategory[];
  keywords: KeywordReport;
  jd: JdAnalysis | null;
  note: string;
}

export interface ScoreInput {
  profile: Profile;
  variant: Variant;
  resume: ResolvedResume;
  pages?: number | null;
  verify?: VerifyResult | null;
  now?: Date;
}

export const SCORE_NOTE = 'This is an estimate; real ATS systems vary.';

const round1 = (n: number) => Math.round(n * 10) / 10;

function category(id: ScoreCategory['id'], label: string, max: number, items: ScoreItem[]): ScoreCategory {
  const raw = items.reduce((sum, i) => sum + i.points, 0);
  return { id, label, max, items, score: round1(Math.max(0, Math.min(max, raw))) };
}

function item(label: string, ok: boolean, max: number, fix?: string, points?: number): ScoreItem {
  return { label, ok, max, points: points ?? (ok ? max : 0), ...(ok || !fix ? {} : { fix }) };
}

/** All text the user has confirmed anywhere in the master profile (visible or hidden). */
function profileText(profile: Profile): string {
  const parts: string[] = [profile.summary, profile.personal.headline];
  for (const c of profile.skills) parts.push(c.name, ...c.items.map((i) => i.name));
  for (const e of profile.experience) parts.push(e.title, e.company, ...e.bullets.map((b) => b.text));
  for (const p of profile.projects) parts.push(p.name, p.stack, ...p.bullets.map((b) => b.text));
  for (const c of profile.certifications) parts.push(c.name, c.issuer);
  for (const a of profile.achievements) parts.push(a.text);
  return parts.join('\n');
}

export function targetTerms(variant: Variant): { terms: Term[]; source: 'job' | 'role'; label: string; jd: JdAnalysis | null } {
  if (hasUsableJd(variant.jobDescription)) {
    const jd = analyzeJobDescription(variant.jobDescription);
    const terms = [...jd.hardSkills, ...jd.tools];
    if (terms.length > 0) return { terms, source: 'job', label: 'the pasted job description', jd };
  }
  const preset = presetById(variant.preset);
  const names = [...(preset?.keywords ?? []), ...variant.customKeywords.map(clean).filter(Boolean)];
  const seen = new Set<string>();
  const terms: Term[] = [];
  for (const n of names) {
    const t = customTerm(n);
    const key = t.canonical.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      terms.push(t);
    }
  }
  const jd = hasUsableJd(variant.jobDescription) ? analyzeJobDescription(variant.jobDescription) : null;
  return { terms, source: 'role', label: `the ${variant.name} keyword library`, jd };
}

export function scoreResume(input: ScoreInput): ScoreResult {
  const { profile, variant, resume, verify } = input;
  const now = input.now ?? new Date();
  const text = resumePlainText(resume);
  const words = wordCount(text);
  const pages = input.pages ?? verify?.pages ?? null;
  const has = (k: string) => resume.sections.some((s) => s.key === k);

  // ---------- Format & parsability (25)
  const rawContent = profileText(profile) + resume.headline + resume.name;
  const removedChars = sanitizeDetailed(rawContent).removed.filter((c) => !/[•●▪◦]/.test(c));
  const verifyFailed = verify ? verify.checks.filter((c) => !c.pass && c.id !== 'meta') : [];
  let pageItem: ScoreItem;
  if (pages === null) {
    pageItem = item('Page count', false, 5, 'The PDF has not been generated yet.', 3);
  } else if (pages <= 1) {
    pageItem = item('Fits on 1 page', true, 5);
  } else if (pages === 2) {
    const earned = words > 600;
    pageItem = item('2 pages', earned, 5, 'Content is short for 2 pages. Use Auto-fit or trim to fit on 1 page.', earned ? 5 : 3);
  } else {
    pageItem = item(`${pages} pages`, false, 5, 'Over 2 pages. Remove older or less relevant items, then use Auto-fit.');
  }
  const format = category('format', 'Format and parsability', 25, [
    item(
      'Single column, no tables, images or graphics',
      verify ? verify.checks.find((c) => c.id === 'images')?.pass !== false : true,
      4,
      'Images were found in the PDF.',
    ),
    item('Standard section headings', resume.sections.length > 0, 4, 'Add content so standard sections appear.'),
    verify
      ? item(
          'Text layer verified (extractable text in reading order)',
          verifyFailed.length === 0,
          10,
          `Text check failed: ${verifyFailed.map((c) => c.label).join(', ')}.`,
          verifyFailed.length === 0 ? 10 : Math.max(0, 10 - verifyFailed.length * 3),
        )
      : item('Text layer verified', false, 10, 'Waiting for the PDF preview to finish.', 7),
    pageItem,
    item(
      'No emoji or unsupported symbols',
      removedChars.length === 0,
      2,
      `Remove unsupported characters (${Array.from(new Set(removedChars)).slice(0, 6).join(' ')}). They are dropped from the PDF.`,
    ),
  ]);

  // ---------- Keywords (30)
  const target = targetTerms(variant);
  const confirmed = profileText(profile);
  const matched: string[] = [];
  const missing: MissingKeyword[] = [];
  const stuffed: Array<{ term: string; count: number }> = [];
  for (const term of target.terms) {
    const count = countTerm(term, text);
    if (count > 0) {
      matched.push(term.canonical);
      if (count > 6) stuffed.push({ term: term.canonical, count });
    } else {
      const implied = term.impliedBy?.find((u) => {
        const t = findTerm(u) ?? customTerm(u);
        return hasTerm(t, text) || text.toLowerCase().includes(u.toLowerCase());
      });
      missing.push({ term: term.canonical, inProfile: hasTerm(term, confirmed), ...(implied ? { impliedBy: implied } : {}) });
    }
  }
  const skillItems = resume.sections.flatMap((s) => (s.key === 'skills' ? s.groups.flatMap((g) => g.items) : []));
  const dupSkills = skillItems.filter((s, i) => skillItems.findIndex((x) => x.toLowerCase() === s.toLowerCase()) !== i);
  const tooManySkills = skillItems.length > 45;
  const stuffPenalty = Math.min(10, stuffed.length * 3 + (tooManySkills ? 4 : 0) + Math.min(3, dupSkills.length));
  const ratio = target.terms.length ? matched.length / target.terms.length : 0;
  const kwPoints = target.terms.length ? Math.min(1, ratio / 0.75) * 30 : 15;
  const keywordItems: ScoreItem[] = [
    item(
      `Matched ${matched.length} of ${target.terms.length} keywords from ${target.label}`,
      ratio >= 0.75,
      30,
      target.terms.length
        ? 'See missing keywords below. Only add ones you genuinely have.'
        : 'Add keywords for this custom role, or paste a job description.',
      round1(kwPoints),
    ),
  ];
  if (stuffed.length || tooManySkills || dupSkills.length) {
    keywordItems.push(
      item(
        'Keyword stuffing',
        false,
        0,
        [
          stuffed.length ? `Repeated too often: ${stuffed.map((s) => `${s.term} (${s.count}x)`).join(', ')}.` : '',
          tooManySkills ? `${skillItems.length} skills listed; keep the most relevant 15-40.` : '',
          dupSkills.length ? `Duplicate skills: ${Array.from(new Set(dupSkills)).join(', ')}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
        -stuffPenalty,
      ),
    );
  }
  const keywords = category('keywords', 'Keyword match', 30, keywordItems);

  // ---------- Section completeness (15)
  const p = profile.personal;
  const contactFilled = [clean(p.fullName), clean(p.email), clean(p.phone)].filter(Boolean).length;
  const sections = category('sections', 'Section completeness', 15, [
    item('Contact: name, email, phone', contactFilled === 3, 3, 'Add your name, email and phone.', contactFilled),
    item('Summary', has('summary'), 3, 'Add a 2-4 line summary targeted to this role.'),
    item('Skills', has('skills'), 3, 'Add a Skills section.'),
    item('Experience or projects', has('experience') || has('projects'), 3, 'Add work experience or projects.'),
    item('Education', has('education'), 3, 'Add your education.'),
  ]);

  // ---------- Bullet quality (15)
  const bullets = printedBullets(resume);
  let bulletCat: ScoreCategory;
  if (!bullets.length) {
    bulletCat = category('bullets', 'Bullet quality', 15, [
      item('Bullet points', false, 15, 'Add 3-5 bullets per role or project describing what you did and the result.'),
    ]);
  } else {
    const verbs = bullets.filter((b) => startsWithActionVerb(b.text));
    const metrics = bullets.filter((b) => hasMetric(b.text));
    const lengthOk = bullets.filter((b) => b.text.length <= MAX_BULLET_CHARS && b.text.length >= 25);
    const firstBad = (pred: (t: string) => boolean) =>
      bullets
        .filter((b) => pred(b.text))
        .slice(0, 2)
        .map((b) => `"${b.text.slice(0, 50)}${b.text.length > 50 ? '...' : ''}"`)
        .join(', ');
    const vr = verbs.length / bullets.length;
    const mr = metrics.length / bullets.length;
    const lr = lengthOk.length / bullets.length;
    bulletCat = category('bullets', 'Bullet quality', 15, [
      item(
        `${verbs.length}/${bullets.length} start with an action verb`,
        vr >= 0.9,
        6,
        `Start with an action verb: ${firstBad((t) => !startsWithActionVerb(t))}`,
        round1(vr * 6),
      ),
      item(
        `${metrics.length}/${bullets.length} include a number`,
        mr >= 0.5,
        5,
        `Add real metrics where you have them: ${firstBad((t) => !hasMetric(t))}`,
        round1(Math.min(1, mr / 0.5) * 5),
      ),
      item(
        `${lengthOk.length}/${bullets.length} are a good length (1-2 lines)`,
        lr >= 0.9,
        4,
        `Shorten or expand: ${firstBad((t) => analyzeBullet(t).some((i) => i.kind === 'long' || i.kind === 'short'))}`,
        round1(lr * 4),
      ),
    ]);
  }

  // ---------- Contact & links (5)
  const links = [p.portfolio, p.github, p.linkedin, ...p.otherLinks.map((l) => l.url)].map(clean).filter(Boolean);
  const badLinks = links.filter((l) => !isValidUrl(l));
  const contact = category('contact', 'Contact and links', 5, [
    item('Valid email', isValidEmail(p.email), 2, 'Add a valid email address.'),
    item('Valid phone', isValidPhone(p.phone), 1, 'Add a phone number with country code.'),
    item('At least one profile link', links.length - badLinks.length > 0, 1, 'Add LinkedIn, GitHub or a portfolio link.'),
    item('All links are valid', badLinks.length === 0, 1, `Fix: ${badLinks.join(', ')}`),
  ]);
  if (!clean(p.linkedin)) {
    contact.items.push({
      label: 'LinkedIn URL',
      ok: false,
      points: 0,
      max: 0,
      fix: 'Many recruiters expect a LinkedIn URL. Add yours if you have one.',
    });
  }

  // ---------- Length & density (5)
  let lengthPoints: number;
  let lengthFix = '';
  if (words < 150) {
    lengthPoints = 1;
    lengthFix = `Only ${words} words. Most strong resumes have 300-800.`;
  } else if (words < 300) {
    lengthPoints = 3;
    lengthFix = `${words} words. Add more detail on your work and results.`;
  } else if (words <= 900) {
    lengthPoints = 5;
  } else {
    lengthPoints = pages !== null && pages <= 2 ? 4 : 2;
    lengthFix = `${words} words. Trim to the most relevant content.`;
  }
  const summarySection = resume.sections.find((s) => s.key === 'summary');
  const summaryWords = summarySection?.key === 'summary' ? wordCount(summarySection.text) : 0;
  const maxBulletsPerEntry = Math.max(
    0,
    ...resume.sections.flatMap((s) => (s.key === 'experience' || s.key === 'projects' ? s.entries.map((e) => e.bullets.length) : [])),
  );
  const lengthItems = [item(`${words} words`, lengthPoints === 5, 5, lengthFix, lengthPoints)];
  if (summaryWords > 80) {
    lengthItems.push(item('Summary length', false, 0, `Summary is ${summaryWords} words; keep it under 80.`, -1));
  }
  if (maxBulletsPerEntry > 7) {
    lengthItems.push(item('Bullets per entry', false, 0, `An entry has ${maxBulletsPerEntry} bullets; keep 3-6 of the strongest.`, -1));
  }
  const length = category('length', 'Length and density', 5, lengthItems);

  // ---------- Consistency (5)
  const dated = [
    ...profile.experience.filter((e) => resume.sections.some((s) => s.key === 'experience' && s.entries.some((x) => x.id === e.id))),
    ...profile.education.filter((e) => resume.sections.some((s) => s.key === 'education' && s.entries.some((x) => x.id === e.id))),
  ];
  const invalid = dated.filter((e) => validateRange(e.start, e.end, now) !== null);
  const missingDates = profile.experience.filter(
    (e) => resume.sections.some((s) => s.key === 'experience' && s.entries.some((x) => x.id === e.id)) && !e.start,
  );
  const tenseIssues = bullets.filter((b) => b.ended && isPresentTenseVerb(b.text));
  const withPeriod = bullets.filter((b) => /\.$/.test(b.text)).length;
  const punctOk = bullets.length === 0 || withPeriod === 0 || withPeriod === bullets.length;
  const consistency = category('consistency', 'Consistency', 5, [
    item(
      'Dates valid and complete',
      invalid.length === 0 && missingDates.length === 0,
      2,
      invalid.length ? 'Some end dates are before start dates.' : 'Add start dates to every role (Mon YYYY - Mon YYYY).',
      invalid.length ? 0 : missingDates.length ? 1 : 2,
    ),
    item(
      'Past roles use past tense',
      tenseIssues.length === 0,
      2,
      `Use past tense for finished roles: "${tenseIssues[0]?.text.slice(0, 50) ?? ''}"`,
    ),
    item('Bullet punctuation consistent', punctOk, 1, 'End all bullets with a period, or none of them.'),
  ]);

  const categories = [format, keywords, sections, bulletCat, contact, length, consistency];
  const total = Math.round(categories.reduce((s, c) => s + c.score, 0));
  return {
    total: Math.max(0, Math.min(100, total)),
    categories,
    keywords: { source: target.source, sourceLabel: target.label, matched, missing, stuffed },
    jd: target.jd,
    note: SCORE_NOTE,
  };
}
