import { parseLooseDate } from '../dates';
import { emptyProfile } from '../seed';
import { clean, uid } from '../utils';
import type { ImportDraft, UnmappedLine } from './parse';
import { SENSITIVE_JSON_KEYS, type Removed } from './sensitive';

/** Maps a JSON Resume (https://jsonresume.org/schema) document into an import draft. */

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? clean(v) : typeof v === 'number' ? String(v) : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Obj[] => arr(v).filter(isObj);
const strs = (v: unknown): string[] => arr(v).map(str).filter(Boolean);

function isoToStored(v: unknown): string {
  const s = str(v);
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(s);
  if (m) return m[2] ? `${m[1]}-${m[2]}` : (m[1] ?? '');
  return parseLooseDate(s);
}

function endDate(v: unknown): string {
  const s = str(v);
  if (!s) return 'present';
  return isoToStored(s);
}

/** Removes sensitive keys anywhere in the object, recording what was removed. */
function scrub(value: unknown, removed: Removed[], path = ''): unknown {
  if (Array.isArray(value)) return value.map((v, i) => scrub(v, removed, `${path}[${i}]`));
  if (!isObj(value)) return value;
  const out: Obj = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_JSON_KEYS.test(k)) {
      const text = typeof v === 'string' ? v : JSON.stringify(v);
      if (text && text !== '""' && text !== '{}') {
        removed.push({
          reason: /image|photo|picture|avatar/i.test(k) ? 'Photo' : /address|street|postal|zip/i.test(k) ? 'Street address' : k,
          text: text.slice(0, 80),
        });
      }
      continue;
    }
    out[k] = scrub(v, removed, `${path}.${k}`);
  }
  return out;
}

const KNOWN = new Set([
  'basics',
  'work',
  'volunteer',
  'education',
  'awards',
  'certificates',
  'publications',
  'skills',
  'languages',
  'interests',
  'references',
  'projects',
  'meta',
  '$schema',
]);

export function mapJsonResume(input: unknown): ImportDraft | null {
  if (!isObj(input)) return null;
  if (!isObj(input.basics) && !Array.isArray(input.work) && !Array.isArray(input.education)) return null;
  const removed: Removed[] = [];
  const data = scrub(input, removed) as Obj;
  const profile = emptyProfile();
  const unmapped: UnmappedLine[] = [];
  const notices: string[] = [];
  const push = (text: string, from: string) => {
    if (clean(text)) unmapped.push({ id: uid('um'), text: clean(text), from });
  };

  const basics = isObj(data.basics) ? data.basics : {};
  const p = profile.personal;
  p.fullName = str(basics.name);
  p.headline = str(basics.label);
  p.email = str(basics.email);
  p.phone = str(basics.phone);
  if (str(basics.url)) p.portfolio = str(basics.url);
  const loc = isObj(basics.location) ? basics.location : {};
  p.city = str(loc.city);
  p.state = str(loc.region);
  p.country = str(loc.countryCode) || str(loc.country);
  profile.summary = str(basics.summary);
  for (const prof of objs(basics.profiles)) {
    const url =
      str(prof.url) || (str(prof.network) && str(prof.username) ? `${str(prof.network).toLowerCase()}.com/${str(prof.username)}` : '');
    if (!url) continue;
    if (/linkedin/i.test(url) && !p.linkedin) p.linkedin = url;
    else if (/github/i.test(url) && !p.github) p.github = url;
    else if (!p.portfolio) p.portfolio = url;
    else p.otherLinks.push({ id: uid('lnk'), label: str(prof.network), url });
  }

  for (const w of objs(data.work)) {
    const bullets = [...strs(w.highlights)];
    const summary = str(w.summary) || str(w.description);
    if (summary) bullets.unshift(summary);
    profile.experience.push({
      id: uid('exp'),
      company: str(w.name) || str(w.company),
      title: str(w.position),
      location: str(w.location),
      start: isoToStored(w.startDate),
      end: str(w.startDate) ? endDate(w.endDate) : isoToStored(w.endDate),
      bullets: bullets.map((text) => ({ id: uid('b'), text })),
    });
  }

  for (const e of objs(data.education)) {
    const degree = [str(e.studyType), str(e.area)].filter(Boolean).join(', ');
    const details = [str(e.score) ? `Score: ${str(e.score)}` : '', ...strs(e.courses)].filter(Boolean).join(', ');
    profile.education.push({
      id: uid('edu'),
      institution: str(e.institution),
      degree,
      location: str(e.location),
      start: isoToStored(e.startDate),
      end: isoToStored(e.endDate),
      details,
    });
  }

  for (const s of objs(data.skills)) {
    const items = strs(s.keywords);
    const name = str(s.name);
    if (items.length) profile.skills.push({ id: uid('cat'), name, items: items.map((n) => ({ id: uid('sk'), name: n })) });
    else if (name) {
      let general = profile.skills.find((c) => c.name === 'Skills');
      if (!general) {
        general = { id: uid('cat'), name: 'Skills', items: [] };
        profile.skills.push(general);
      }
      general.items.push({ id: uid('sk'), name });
    }
  }

  for (const pr of objs(data.projects)) {
    const bullets = [...strs(pr.highlights)];
    if (str(pr.description)) bullets.unshift(str(pr.description));
    profile.projects.push({
      id: uid('prj'),
      name: str(pr.name),
      stack: strs(pr.keywords).join(', '),
      link: str(pr.url),
      bullets: bullets.map((text) => ({ id: uid('b'), text })),
    });
  }

  for (const c of objs(data.certificates)) {
    profile.certifications.push({ id: uid('cert'), name: str(c.name), issuer: str(c.issuer), date: isoToStored(c.date), link: str(c.url) });
  }

  for (const a of objs(data.awards)) {
    const text = [str(a.title), str(a.awarder), str(a.summary)].filter(Boolean).join(' - ');
    if (text) profile.achievements.push({ id: uid('ach'), text });
  }

  for (const l of objs(data.languages)) {
    if (str(l.language)) profile.languages.push({ id: uid('lang'), name: str(l.language), proficiency: str(l.fluency) });
  }

  for (const v of objs(data.volunteer))
    push([str(v.position), str(v.organization), str(v.summary), ...strs(v.highlights)].filter(Boolean).join(' - '), 'Volunteer');
  for (const pub of objs(data.publications))
    push([str(pub.name), str(pub.publisher), str(pub.url)].filter(Boolean).join(' - '), 'Publications');
  for (const i of objs(data.interests)) push([str(i.name), ...strs(i.keywords)].join(', '), 'Interests');
  for (const r of objs(data.references)) push([str(r.name), str(r.reference)].filter(Boolean).join(' - '), 'References');
  for (const [k, v] of Object.entries(data)) {
    if (!KNOWN.has(k)) push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`, 'Other JSON fields');
  }

  if (removed.length) {
    notices.push(
      `Removed personal details that should not be on a resume: ${Array.from(new Set(removed.map((r) => r.reason))).join(', ')}.`,
    );
  }
  return { profile, unmapped, removed, notices };
}
