import { extractRange, parseLooseDate, SINGLE_DATE_REGEX } from '../dates';
import { emptyProfile } from '../seed';
import type { Certification, Education, Experience, Profile, Project, SkillCategory } from '../schema';
import { clean, uid } from '../utils';
import { isValidEmail } from '../validation';
import { stripSensitiveLine, type Removed } from './sensitive';

/**
 * Best-effort mapping of resume text into the data model. Nothing is silently dropped:
 * every line ends up in a field, in `unmapped` (for the user to assign), or in `removed`
 * (sensitive data that the app never stores, shown to the user as a notice).
 */

export interface UnmappedLine {
  id: string;
  text: string;
  from: string;
}

export interface ImportDraft {
  profile: Profile;
  unmapped: UnmappedLine[];
  removed: Removed[];
  notices: string[];
}

type Bucket =
  'summary' | 'skills' | 'experience' | 'projects' | 'education' | 'certifications' | 'achievements' | 'languages' | 'personal' | 'other';

const HEADINGS: Array<[Bucket, RegExp]> = [
  [
    'summary',
    /^(professional\s+|career\s+|executive\s+)?(summary|profile|objective|about(\s+me)?|career\s+objective|overview|introduction)$/,
  ],
  [
    'skills',
    /^((technical|core|key|professional|relevant)\s+)?(skills|skill\s*set|competencies|expertise|technologies|tech\s*stack|tools(\s*(and|&)\s*technologies)?|technical\s+proficiency)(\s*(and|&)\s*(tools|technologies|expertise))?$/,
  ],
  [
    'experience',
    /^((work|professional|relevant|employment|career)\s+)?(experience|history|employment(\s+history)?|work\s+history|internships?)(\s*(and|&)\s*internships?)?$/,
  ],
  ['projects', /^((personal|academic|key|selected|notable|side)\s+)?projects?$/],
  [
    'education',
    /^(education(al)?(\s+(background|qualifications?|details))?|academic(s|\s+(background|qualifications?|details))?|qualifications?)$/,
  ],
  [
    'certifications',
    /^(certifications?|certificates?|licen[cs]es?(\s*(and|&)\s*certifications?)?|courses?(\s*(and|&)\s*certifications?)?|certifications?\s*(and|&)\s*(courses?|training)|training)$/,
  ],
  [
    'achievements',
    /^(achievements?|awards?(\s*(and|&)\s*(achievements?|honou?rs?))?|accomplishments?|honou?rs?(\s*(and|&)\s*awards?)?|recognitions?)$/,
  ],
  ['languages', /^(languages?(\s+known)?|spoken\s+languages?)$/],
  ['personal', /^(personal\s+(details|information|info|profile|data)|personal)$/],
  [
    'other',
    /^(hobbies|interests|hobbies\s*(and|&)\s*interests|extra[\s-]?curricular(\s+activities)?|volunteer(ing)?(\s+experience)?|declaration|references?|publications?|activities|positions?\s+of\s+responsibility|leadership)$/,
  ],
];

export function headingBucket(line: string): Bucket | null {
  const t = clean(line)
    .replace(/[:\-–—_|]+$/, '')
    .trim();
  if (!t || t.split(' ').length > 6 || /[@.]\w/.test(t)) return null;
  const n = t
    .toLowerCase()
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ');
  for (const [bucket, re] of HEADINGS) if (re.test(n)) return bucket;
  return null;
}

const BULLET_RE = /^\s*(?:[•●▪◦‣⁃○■□➢➤►▸✓✔*\-–—]|[-]|\d{1,2}[.)])\s*/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}/g;
const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/[^\s|,;()]*)?/gi;

function isBullet(line: string): boolean {
  return BULLET_RE.test(line) && clean(line.replace(BULLET_RE, '')).length > 0;
}

function stripBullet(line: string): string {
  return clean(line.replace(BULLET_RE, ''));
}

const NOT_URLS = /^(socket\.io|asp\.net|ado\.net|vb\.net|dot\.net|b\.sc|m\.sc|b\.com|m\.com|e\.g|i\.e)$/i;
const URL_TLDS =
  /\.(com|in|dev|io|me|net|org|app|site|space|tech|co|xyz|page|link|ai|tv|so|sh|us|uk|ca|au|de|info|online|store|blog|design|codes|website|pro)$/i;

function findUrls(text: string): string[] {
  const withoutEmails = text.replace(EMAIL_RE, ' ');
  return Array.from(withoutEmails.matchAll(URL_RE))
    .map((m) => m[0].replace(/[.)]+$/, ''))
    .filter((u) => {
      if (NOT_URLS.test(u) || /^\d+(\.\d+)+$/.test(u)) return false;
      if (/^(https?:\/\/|www\.)/i.test(u)) return true;
      const host = u.split('/')[0] ?? '';
      return URL_TLDS.test(host);
    });
}

function findPhones(text: string): string[] {
  return Array.from(text.matchAll(PHONE_RE))
    .map((m) => clean(m[0]))
    .filter((p) => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    });
}

function splitList(text: string): string[] {
  return text
    .split(/\s*(?:,|\||•|·|;|•)\s*/)
    .map(clean)
    .filter(Boolean);
}

interface Block {
  bucket: Bucket;
  heading: string;
  lines: string[];
}

/** Joins wrapped lines: a non-bullet line starting lowercase continues the previous line. */
function mergeContinuations(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && !isBullet(line) && /^[a-z(]/.test(line) && !extractRange(line) && !headingBucket(line)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

const LOCATION_HINT = /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+(,\s*[A-Za-z .'-]+)?$|^(remote|hybrid|on-?site)$/i;

interface EntryChunk {
  header: string[];
  bullets: string[];
}

function chunkEntries(lines: string[]): EntryChunk[] {
  const chunks: EntryChunk[] = [];
  let cur: EntryChunk | null = null;
  for (const raw of lines) {
    if (isBullet(raw)) {
      if (!cur) {
        cur = { header: [], bullets: [] };
        chunks.push(cur);
      }
      cur.bullets.push(stripBullet(raw));
      continue;
    }
    const line = clean(raw);
    const looksLikeSentence = line.length > 80 || (/\.$/.test(line) && line.split(' ').length > 6);
    if (cur && looksLikeSentence) {
      cur.bullets.push(line);
      continue;
    }
    if (!cur || cur.bullets.length > 0 || (cur.header.length >= 2 && extractRange(line) && cur.header.some((h) => extractRange(h)))) {
      cur = { header: [], bullets: [] };
      chunks.push(cur);
    }
    cur.header.push(line);
  }
  return chunks;
}

function splitHeaderPieces(header: string[]): { pieces: string[]; start: string; end: string } {
  let start = '';
  let end = '';
  const pieces: string[] = [];
  for (const h of header) {
    let line = h;
    if (!start && !end) {
      const r = extractRange(line);
      if (r) {
        start = r.start;
        end = r.end;
        line = r.rest;
      }
    }
    const parts = line
      .split(/\s+(?:\||–|—|-|·|•)\s+|\s*\|\s*|\s+at\s+|\s+@\s+/i)
      .map((p) =>
        clean(p)
          .replace(/^[,(]+|[,)]+$/g, '')
          .trim(),
      )
      .filter(Boolean);
    pieces.push(...parts);
  }
  return { pieces, start, end };
}

function parseExperience(lines: string[], unmapped: UnmappedLine[], from: string): Experience[] {
  return chunkEntries(lines).map((c) => {
    const { pieces, start, end } = splitHeaderPieces(c.header);
    let location = '';
    const rest: string[] = [];
    for (const p of pieces) {
      if (!location && LOCATION_HINT.test(p) && pieces.indexOf(p) > 0) location = p;
      else rest.push(p);
    }
    const [title = '', company = '', ...extra] = rest;
    for (const e of extra) unmapped.push({ id: uid('um'), text: e, from });
    return {
      id: uid('exp'),
      title,
      company,
      location,
      start,
      end,
      bullets: c.bullets.map((text) => ({ id: uid('b'), text })),
    };
  });
}

function parseProjects(lines: string[], unmapped: UnmappedLine[], from: string): Project[] {
  return chunkEntries(lines).map((c) => {
    let link = '';
    let stack = '';
    const names: string[] = [];
    const bullets = [...c.bullets];
    for (const h of c.header) {
      const stackMatch = /^(?:tech(?:nologies|\s*stack)?|stack|built\s+with|tools)\s*[:\-–]\s*(.+)$/i.exec(h);
      if (stackMatch?.[1]) {
        stack = stack ? `${stack}, ${stackMatch[1]}` : clean(stackMatch[1]);
        continue;
      }
      const urls = findUrls(h);
      let rest = h;
      if (urls[0] && !link) {
        link = urls[0];
        rest = clean(h.replace(urls[0], ' ')).replace(/^(link|github|demo|live)\s*[:\-–]?\s*$/i, '');
      }
      const range = extractRange(rest);
      if (range) rest = range.rest;
      const parts = rest
        .split(/\s*\|\s*|\s+[–—-]\s+/)
        .map(clean)
        .filter(Boolean);
      for (const p of parts) {
        if (!names.length) names.push(p);
        else if (!stack && /,/.test(p)) stack = p;
        else if (/[:]$/.test(p)) continue;
        else unmapped.push({ id: uid('um'), text: p, from });
      }
    }
    return {
      id: uid('prj'),
      name: names[0] ?? '',
      stack,
      link,
      bullets: bullets.map((text) => ({ id: uid('b'), text })),
    };
  });
}

const INSTITUTION_RE = /\b(university|college|institute|institution|school|academy|vidyalaya|polytechnic|iit|nit|iiit|bits)\b/i;
const DEGREE_RE =
  /\b(b\.?\s?tech|b\.?\s?e\b|bachelor|master|m\.?\s?tech|mca|bca|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|m\.?\s?com|diploma|hsc|ssc|12th|10th|xii|x\b|ph\.?\s?d|mba|bba|associate|degree|b\.?\s?a\b|m\.?\s?a\b|certificate)\b/i;
const DETAIL_RE =
  /\b(cgpa|gpa|percentage|grade|score|marks|honou?rs|distinction|first\s+class|coursework|relevant courses?)\b|\d+(\.\d+)?\s*%|\d\.\d{1,2}\s*\/\s*10/i;

function parseEducation(lines: string[], unmapped: UnmappedLine[], from: string): Education[] {
  const out: Education[] = [];
  let cur: Education | null = null;
  const fresh = (): Education => ({ id: uid('edu'), institution: '', degree: '', location: '', start: '', end: '', details: '' });
  for (const raw of lines) {
    let line = isBullet(raw) ? stripBullet(raw) : clean(raw);
    const r = extractRange(line);
    let start = '';
    let end = '';
    if (r) {
      start = r.start;
      end = r.end;
      line = r.rest;
    } else {
      const single = SINGLE_DATE_REGEX.exec(line);
      if (single && !DETAIL_RE.test(line)) {
        end = parseLooseDate(single[1] ?? '');
        line = clean(line.replace(single[0], ' '))
          .replace(/^[,|–—-]+|[,|–—-]+$/g, '')
          .trim();
      }
    }
    const pieces = line
      .split(/\s*\|\s*|\s+[–—-]\s+|,\s+(?=[A-Z])/)
      .map(clean)
      .filter(Boolean);
    for (const piece of pieces) {
      const isInst = INSTITUTION_RE.test(piece);
      const isDeg = DEGREE_RE.test(piece) && !isInst;
      const isDetail = DETAIL_RE.test(piece) && !isDeg && !isInst;
      if (!cur || (isInst && cur.institution) || (isDeg && cur.degree)) {
        cur = fresh();
        out.push(cur);
      }
      if (isInst) cur.institution = piece;
      else if (isDeg) cur.degree = piece;
      else if (isDetail) cur.details = cur.details ? `${cur.details}, ${piece}` : piece;
      else if (!cur.location && LOCATION_HINT.test(piece)) cur.location = piece;
      else if (!cur.degree) cur.degree = piece;
      else if (!cur.institution) cur.institution = piece;
      else unmapped.push({ id: uid('um'), text: piece, from });
    }
    if (cur && (start || end)) {
      if (!cur.start && start) cur.start = start;
      if (!cur.end && end) cur.end = end;
    } else if (!cur && (start || end)) {
      cur = { ...fresh(), start, end };
      out.push(cur);
    }
  }
  return out;
}

function parseCertifications(lines: string[]): Certification[] {
  return lines
    .map((l) => (isBullet(l) ? stripBullet(l) : clean(l)))
    .filter(Boolean)
    .map((line) => {
      const urls = findUrls(line);
      let rest = urls[0] ? clean(line.replace(urls[0], ' ')) : line;
      let date = '';
      const single = SINGLE_DATE_REGEX.exec(rest);
      if (single) {
        date = parseLooseDate(single[1] ?? '');
        rest = clean(rest.replace(single[0], ' '))
          .replace(/[,|–—-]+$/, '')
          .trim();
      }
      const parts = rest
        .split(/\s*\|\s*|\s+[–—-]\s+|\s*,\s*(?=[A-Z])|\s+by\s+/)
        .map((p) =>
          clean(p)
            .replace(/^[(,]+|[),]+$/g, '')
            .trim(),
        )
        .filter(Boolean);
      return {
        id: uid('cert'),
        name: parts[0] ?? rest,
        issuer: parts.slice(1).join(', '),
        date,
        link: urls[0] ?? '',
      };
    });
}

function parseSkills(lines: string[]): SkillCategory[] {
  const cats: SkillCategory[] = [];
  let general: SkillCategory | null = null;
  for (const raw of lines) {
    const line = isBullet(raw) ? stripBullet(raw) : clean(raw);
    const m = /^([A-Za-z][A-Za-z0-9 &/+.-]{1,40}?)\s*[:\-–]\s+(.+)$/.exec(line);
    if (m?.[1] && m[2]) {
      cats.push({ id: uid('cat'), name: clean(m[1]), items: splitList(m[2]).map((name) => ({ id: uid('sk'), name })) });
    } else {
      if (!general) {
        general = { id: uid('cat'), name: 'Skills', items: [] };
        cats.push(general);
      }
      general.items.push(...splitList(line).map((name) => ({ id: uid('sk'), name })));
    }
  }
  return cats.filter((c) => c.items.length);
}

function parseLanguages(lines: string[]) {
  return lines.flatMap((l) =>
    splitList(isBullet(l) ? stripBullet(l) : l).map((item) => {
      const m = /^(.+?)\s*[(:\-–]\s*([^)]+)\)?$/.exec(item);
      return { id: uid('lang'), name: clean(m?.[1] ?? item), proficiency: clean(m?.[2] ?? '') };
    }),
  );
}

export function parseResumeText(input: string, extraNotices: string[] = []): ImportDraft {
  const profile = emptyProfile();
  const unmapped: UnmappedLine[] = [];
  const removed: Removed[] = [];
  const notices = [...extraNotices];

  const rawLines = input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').replace(/\s+$/g, ''))
    .filter((l) => clean(l).length > 0);

  // Split into blocks by headings.
  const header: string[] = [];
  const blocks: Block[] = [];
  for (const line of rawLines) {
    const bucket = headingBucket(line);
    if (bucket) {
      blocks.push({ bucket, heading: clean(line).replace(/[:]+$/, ''), lines: [] });
    } else if (blocks.length) {
      blocks[blocks.length - 1]!.lines.push(line);
    } else {
      header.push(line);
    }
  }

  // Strip sensitive data. Addresses are only detected in the header and personal sections.
  const scrub = (lines: string[], allowAddress: boolean): string[] =>
    lines
      .map((l) => {
        const r = stripSensitiveLine(l, allowAddress);
        removed.push(...r.removed);
        return r.kept;
      })
      .filter((l) => clean(l));
  const headerLines = scrub(header, true);
  for (const b of blocks) b.lines = scrub(b.lines, b.bucket === 'personal' || b.bucket === 'other');

  // ---- Contact details (header first, then anywhere)
  const p = profile.personal;
  const headerText = headerLines.join('\n');
  const allText = [headerText, ...blocks.filter((b) => b.bucket === 'personal').flatMap((b) => b.lines)].join('\n');
  const emails = Array.from(allText.matchAll(EMAIL_RE))
    .map((m) => m[0])
    .filter(isValidEmail);
  p.email = emails[0] ?? '';
  const phones = findPhones(allText.replace(EMAIL_RE, ' '));
  p.phone = phones[0] ?? '';
  const urls = findUrls(allText);
  for (const u of urls) {
    if (/linkedin\.com/i.test(u) && !p.linkedin) p.linkedin = u;
    else if (/github\.com/i.test(u) && !p.github) p.github = u;
    else if (!p.portfolio) p.portfolio = u;
    else p.otherLinks.push({ id: uid('lnk'), label: '', url: u });
  }

  const consumed = new Set<string>([...emails.slice(0, 1), ...phones.slice(0, 1), ...urls]);
  const leftover = (seg: string) => {
    let t = seg;
    for (const c of consumed) t = t.split(c).join(' ');
    return clean(t.replace(/\b(email|e-mail|phone|mobile|mob|tel|linkedin|github|portfolio|website)\s*[:\-–]?\s*/gi, ''))
      .replace(/^[|,;:•·-]+|[|,;:•·-]+$/g, '')
      .trim();
  };

  for (let i = 0; i < headerLines.length; i += 1) {
    const segments = headerLines[i]!.split(/\s*(?:\||•|·|•|;)\s*|\s{3,}/)
      .map(leftover)
      .filter(Boolean);
    for (const seg of segments) {
      const wordsN = seg.split(' ').length;
      if (/^(resume|curriculum\s+vitae|cv|bio-?data)$/i.test(seg)) unmapped.push({ id: uid('um'), text: seg, from: 'Header' });
      else if (!p.fullName && wordsN <= 5 && /^[A-Za-z][A-Za-z .'-]+$/.test(seg)) p.fullName = seg;
      else if (!p.headline && p.fullName && wordsN <= 10 && !/,/.test(seg) && /[A-Za-z]/.test(seg)) p.headline = seg;
      else if (!p.city && !p.country && LOCATION_HINT.test(seg)) {
        const parts = seg.split(',').map(clean);
        if (parts.length >= 2) {
          p.country = parts.pop() ?? '';
          p.city = parts.join(', ');
        } else p.city = seg;
      } else if (wordsN > 12 && !profile.summary) {
        profile.summary = seg;
      } else unmapped.push({ id: uid('um'), text: seg, from: 'Header' });
    }
  }

  // ---- Sections
  for (const b of blocks) {
    const lines = mergeContinuations(b.lines);
    switch (b.bucket) {
      case 'summary': {
        const text = lines.map((l) => (isBullet(l) ? stripBullet(l) : clean(l))).join(' ');
        profile.summary = clean([profile.summary, text].filter(Boolean).join(' '));
        break;
      }
      case 'skills':
        profile.skills.push(...parseSkills(lines));
        break;
      case 'experience':
        profile.experience.push(...parseExperience(lines, unmapped, b.heading));
        break;
      case 'projects':
        profile.projects.push(...parseProjects(lines, unmapped, b.heading));
        break;
      case 'education':
        profile.education.push(...parseEducation(lines, unmapped, b.heading));
        break;
      case 'certifications':
        profile.certifications.push(...parseCertifications(lines));
        break;
      case 'achievements':
        profile.achievements.push(...lines.map((l) => ({ id: uid('ach'), text: isBullet(l) ? stripBullet(l) : clean(l) })));
        break;
      case 'languages':
        profile.languages.push(...parseLanguages(lines));
        break;
      case 'personal': {
        for (const l of lines) {
          const m = /^languages?(\s+known)?\s*[:\-–]\s*(.+)$/i.exec(clean(l));
          if (m?.[2]) profile.languages.push(...parseLanguages([m[2]]));
          else {
            const rest = leftover(l);
            if (rest) unmapped.push({ id: uid('um'), text: rest, from: b.heading });
          }
        }
        break;
      }
      case 'other':
        for (const l of lines) unmapped.push({ id: uid('um'), text: isBullet(l) ? stripBullet(l) : clean(l), from: b.heading });
        break;
    }
  }

  if (removed.length) {
    const reasons = Array.from(new Set(removed.map((r) => r.reason)));
    notices.push(`Removed personal details that should not be on a resume: ${reasons.join(', ')}.`);
  }
  if (!blocks.length && rawLines.length > 3) {
    notices.push('No standard section headings were found. Please assign the lines below to sections.');
  }
  return { profile, unmapped, removed, notices };
}
