import { useState } from 'react';
import { formatDate, formatRange } from '../../lib/dates';
import type { Personal, SkillCategory } from '../../lib/schema';
import { clean, uid, wordCount } from '../../lib/utils';
import { checkEmail, checkPhone, checkUrl } from '../../lib/validation';
import { confirmAction } from '../../store/ui';
import { PlusIcon, XIcon } from '../../components/icons';
import { Button, IconButton, TextArea, TextField } from '../../components/ui';
import { cx, FOCUS_RING } from '../../components/cx';
import { BulletsEditor, BulletHints } from './BulletsEditor';
import { reorderById, useEditor, useOrderedList } from './context';
import { DateRangeInput, MonthYearInput } from './DateInputs';
import { EntryList } from './EntryList';
import { DeleteButton, EntryCard, HideToggle } from './Panel';
import { SortableList } from './SortableList';

/* ---------------------------------------------------------------- Personal */

type PersonalKey = Exclude<keyof Personal, 'otherLinks'>;

function useTouched() {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  return { touched, touch: (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true })) };
}

export function PersonalEditor() {
  const { profile, edit } = useEditor();
  const p = profile.personal;
  const { touched, touch } = useTouched();
  const set = (k: PersonalKey) => (v: string) => edit(`personal:${k}`, (d) => void (d.personal[k] = v));
  const err = (k: string, check: { ok: true } | { ok: false; message: string }) => (touched[k] && !check.ok ? check.message : undefined);
  const email = checkEmail(p.email);
  const phone = checkPhone(p.phone);
  const field = (k: PersonalKey, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField label={label} value={p[k]} onValue={set(k)} onBlur={() => touch(k)} {...extra} />
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {field('fullName', 'Full name', { autoComplete: 'name', required: true })}
        {field('headline', 'Default headline (target job title)', { hint: 'Each resume can override this.' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', error: err('email', email) })}
        {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', error: err('phone', phone), hint: 'Include country code, e.g. +91' })}
        {field('city', 'City')}
        {field('state', 'State / region')}
        {field('country', 'Country')}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Only city, state and country are printed. Shortlist never stores a street address, date of birth, age, gender, marital status,
        nationality, religion or photo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field('portfolio', 'Portfolio URL', { inputMode: 'url', error: err('portfolio', checkUrl(p.portfolio)) })}
        {field('github', 'GitHub', { inputMode: 'url', placeholder: 'github.com/username', error: err('github', checkUrl(p.github)) })}
        {field('linkedin', 'LinkedIn', {
          inputMode: 'url',
          placeholder: 'linkedin.com/in/username',
          error: err('linkedin', checkUrl(p.linkedin)),
        })}
      </div>
      <OtherLinks />
    </div>
  );
}

function OtherLinks() {
  const { profile, edit } = useEditor();
  const { touched, touch } = useTouched();
  const links = profile.personal.otherLinks;
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Other links</p>
      <ul className="space-y-2">
        {links.map((l, i) => {
          const check = checkUrl(l.url);
          return (
            <li key={l.id} className="flex items-start gap-2">
              <TextField
                label={`Link ${i + 1} label`}
                srOnlyLabel
                placeholder="Label (optional)"
                value={l.label}
                wrapperClassName="w-32 shrink-0"
                onValue={(v) =>
                  edit(`link:${l.id}:label`, (d) => {
                    const t = d.personal.otherLinks.find((x) => x.id === l.id);
                    if (t) t.label = v;
                  })
                }
              />
              <TextField
                label={`Link ${i + 1} URL`}
                srOnlyLabel
                placeholder="https://..."
                inputMode="url"
                value={l.url}
                wrapperClassName="min-w-0 flex-1"
                onBlur={() => touch(l.id)}
                error={touched[l.id] && !check.ok ? check.message : undefined}
                onValue={(v) =>
                  edit(`link:${l.id}:url`, (d) => {
                    const t = d.personal.otherLinks.find((x) => x.id === l.id);
                    if (t) t.url = v;
                  })
                }
              />
              <DeleteButton
                label={`link ${i + 1}`}
                onClick={() =>
                  edit(`del:link:${l.id}`, (d) => void (d.personal.otherLinks = d.personal.otherLinks.filter((x) => x.id !== l.id)))
                }
              />
            </li>
          );
        })}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        className="mt-1"
        icon={<PlusIcon size={16} />}
        onClick={() => edit(`add:link:${Date.now()}`, (d) => void d.personal.otherLinks.push({ id: uid('lnk'), label: '', url: '' }))}
      >
        Add link
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------- Summary (import draft only) */

export function SummaryField({ value, onChange, label = 'Summary' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const words = wordCount(value);
  return (
    <TextArea
      label={label}
      rows={4}
      value={value}
      onValue={onChange}
      hint="2-4 lines: who you are, your core stack and the value you bring. Aim for 30-80 words."
      trailing={<span className={cx('text-xs tabular-nums', words > 80 ? 'text-amber-600' : 'text-slate-400')}>{words} words</span>}
    />
  );
}

/* ---------------------------------------------------------------- Skills */

function SkillChips({ cat }: { cat: SkillCategory }) {
  const { edit } = useEditor();
  const [draft, setDraft] = useState('');
  const byId = new Map(cat.items.map((i) => [i.id, i]));
  const list = useOrderedList(
    `skillItems:${cat.id}`,
    cat.items.map((i) => i.id),
    (ids) =>
      edit(`reorder:skills:${cat.id}:${Date.now()}`, (p) => {
        const c = p.skills.find((x) => x.id === cat.id);
        if (c) c.items = reorderById(c.items, ids);
      }),
  );
  const addItems = () => {
    const names = draft
      .split(/\s*[,;\n]\s*/)
      .map(clean)
      .filter(Boolean);
    if (!names.length) return;
    edit(`add:skill:${cat.id}:${Date.now()}`, (p) => {
      const c = p.skills.find((x) => x.id === cat.id);
      if (!c) return;
      for (const name of names) {
        if (!c.items.some((i) => i.name.toLowerCase() === name.toLowerCase())) c.items.push({ id: uid('sk'), name });
      }
    });
    setDraft('');
  };
  return (
    <div>
      {list.entries.length ? (
        <SortableList
          layout="grid"
          ariaLabel={`${cat.name || 'Skills'} items`}
          entries={list.entries}
          onReorder={list.reorder}
          itemLabel={(id) => byId.get(id)?.name ?? 'skill'}
          className="flex flex-wrap gap-1.5"
          render={({ id, hidden, handle }) => {
            const item = byId.get(id);
            if (!item) return null;
            return (
              <span
                className={cx(
                  'inline-flex items-center rounded-full border py-0.5 pl-0.5 pr-1 text-sm',
                  hidden
                    ? 'border-dashed border-slate-300 text-slate-400 line-through dark:border-slate-600'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100',
                )}
              >
                {handle}
                <span className="px-0.5">{item.name}</span>
                {list.toggle ? (
                  <button
                    type="button"
                    className={cx('ml-1 rounded px-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white', FOCUS_RING)}
                    aria-label={hidden ? `Show ${item.name} in this resume` : `Hide ${item.name} from this resume`}
                    aria-pressed={hidden}
                    onClick={() => list.toggle?.(id)}
                  >
                    {hidden ? 'show' : 'hide'}
                  </button>
                ) : null}
                <IconButton
                  label={`Remove ${item.name}`}
                  className="h-6 w-6"
                  onClick={() =>
                    edit(`del:skill:${id}`, (p) => {
                      const c = p.skills.find((x) => x.id === cat.id);
                      if (c) c.items = c.items.filter((x) => x.id !== id);
                    })
                  }
                >
                  <XIcon size={14} />
                </IconButton>
              </span>
            );
          }}
        />
      ) : null}
      <div className="mt-2 flex gap-2">
        <TextField
          label={`Add skills to ${cat.name || 'this group'}`}
          srOnlyLabel
          wrapperClassName="flex-1"
          placeholder="Type skills, separated by commas, then press Enter"
          value={draft}
          onValue={setDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItems();
            }
          }}
        />
        <Button size="sm" onClick={addItems} disabled={!clean(draft)}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function SkillsEditor() {
  const { profile, edit, mode } = useEditor();
  const cats = profile.skills;
  const byId = new Map(cats.map((c) => [c.id, c]));
  const list = useOrderedList(
    'skills',
    cats.map((c) => c.id),
    (ids) => edit(`reorder:skills:${Date.now()}`, (p) => void (p.skills = reorderById(p.skills, ids))),
  );
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Only list skills you genuinely have. Groups print as "Group: skill, skill". Drag to reorder; hide what is not relevant to this role.
      </p>
      <SortableList
        ariaLabel="Skill groups"
        entries={list.entries}
        onReorder={list.reorder}
        itemLabel={(id) => byId.get(id)?.name || 'skill group'}
        className="space-y-2"
        render={({ id, hidden, handle }) => {
          const cat = byId.get(id);
          if (!cat) return null;
          return (
            <EntryCard
              title={cat.name || 'Untitled group'}
              meta={`${cat.items.length} skill${cat.items.length === 1 ? '' : 's'}`}
              hidden={hidden}
              handle={handle}
              defaultOpen
              actions={
                <>
                  {list.toggle ? <HideToggle hidden={hidden} label={cat.name || 'group'} onToggle={() => list.toggle?.(id)} /> : null}
                  <DeleteButton
                    label={cat.name || 'group'}
                    onClick={async () => {
                      if (mode === 'variant' && cat.items.length) {
                        const ok = await confirmAction({
                          title: `Delete the "${cat.name || 'Untitled'}" group?`,
                          message: 'This removes the group and its skills from every resume. Use hide to remove it from this resume only.',
                          confirmLabel: 'Delete',
                        });
                        if (!ok) return;
                      }
                      edit(`del:cat:${id}`, (p) => void (p.skills = p.skills.filter((x) => x.id !== id)));
                    }}
                  />
                </>
              }
            >
              <TextField
                label="Group name"
                value={cat.name}
                placeholder="e.g. Languages, Frameworks, Tools"
                onValue={(v) =>
                  edit(`cat:${id}:name`, (p) => {
                    const c = p.skills.find((x) => x.id === id);
                    if (c) c.name = v;
                  })
                }
              />
              <SkillChips cat={cat} />
            </EntryCard>
          );
        }}
      />
      <Button
        size="sm"
        variant="subtle"
        icon={<PlusIcon size={16} />}
        onClick={() => edit(`add:cat:${Date.now()}`, (p) => void p.skills.push({ id: uid('cat'), name: '', items: [] }))}
      >
        Add skill group
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------- Experience / Projects / Education ... */

export function ExperienceEditor() {
  return (
    <EntryList
      section="experience"
      singular="role"
      addLabel="Add experience"
      empty="No experience yet. Add internships and freelance work too."
      newItem={() => ({ id: uid('exp'), company: '', title: '', location: '', start: '', end: '', bullets: [] })}
      title={(e) => [e.title, e.company].map(clean).filter(Boolean).join(', ') || 'Untitled role'}
      meta={(e) => [clean(e.location), formatRange(e.start, e.end)].filter(Boolean).join(' | ')}
      fields={(e, set, patch) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Job title" value={e.title} onValue={(v) => set('title', v)} />
            <TextField label="Company" value={e.company} onValue={(v) => set('company', v)} />
            <TextField label="Location" value={e.location} onValue={(v) => set('location', v)} placeholder="City, Country or Remote" />
          </div>
          <DateRangeInput start={e.start} end={e.end} onChange={(start, end) => patch({ start, end })} />
          <BulletsEditor owner={{ kind: 'experience', id: e.id }} bullets={e.bullets} />
        </>
      )}
    />
  );
}

export function ProjectsEditor() {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  return (
    <EntryList
      section="projects"
      singular="project"
      addLabel="Add project"
      empty="No projects yet."
      newItem={() => ({ id: uid('prj'), name: '', stack: '', link: '', bullets: [] })}
      title={(p) => clean(p.name) || 'Untitled project'}
      meta={(p) => clean(p.stack)}
      fields={(p, set) => {
        const check = checkUrl(p.link);
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Project name" value={p.name} onValue={(v) => set('name', v)} />
              <TextField label="Tech stack" value={p.stack} onValue={(v) => set('stack', v)} placeholder="React, Node.js, MongoDB" />
              <TextField
                label="Link"
                value={p.link}
                inputMode="url"
                wrapperClassName="sm:col-span-2"
                placeholder="github.com/you/project or live URL"
                onValue={(v) => set('link', v)}
                onBlur={() => setTouched((t) => ({ ...t, [p.id]: true }))}
                error={touched[p.id] && !check.ok ? check.message : undefined}
              />
            </div>
            <BulletsEditor owner={{ kind: 'projects', id: p.id }} bullets={p.bullets} />
          </>
        );
      }}
    />
  );
}

export function EducationEditor() {
  return (
    <EntryList
      section="education"
      singular="education"
      addLabel="Add education"
      empty="No education yet."
      newItem={() => ({ id: uid('edu'), institution: '', degree: '', location: '', start: '', end: '', details: '' })}
      title={(e) => [e.degree, e.institution].map(clean).filter(Boolean).join(', ') || 'Untitled education'}
      meta={(e) => formatRange(e.start, e.end)}
      fields={(e, set, patch) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Degree / course" value={e.degree} onValue={(v) => set('degree', v)} placeholder="B.Sc. Computer Science" />
            <TextField label="Institution" value={e.institution} onValue={(v) => set('institution', v)} />
            <TextField label="Location" value={e.location} onValue={(v) => set('location', v)} />
            <TextField
              label="Details"
              value={e.details}
              onValue={(v) => set('details', v)}
              placeholder="CGPA 8.4/10, relevant coursework"
            />
          </div>
          <DateRangeInput start={e.start} end={e.end} presentLabel="Currently studying" onChange={(start, end) => patch({ start, end })} />
        </>
      )}
    />
  );
}

export function CertificationsEditor() {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  return (
    <EntryList
      section="certifications"
      singular="certification"
      addLabel="Add certification"
      empty="No certifications yet."
      newItem={() => ({ id: uid('cert'), name: '', issuer: '', date: '', link: '' })}
      title={(c) => clean(c.name) || 'Untitled certification'}
      meta={(c) => [clean(c.issuer), formatDate(c.date)].filter(Boolean).join(' | ')}
      fields={(c, set) => {
        const check = checkUrl(c.link);
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Certification name" value={c.name} onValue={(v) => set('name', v)} />
            <TextField label="Issuer" value={c.issuer} onValue={(v) => set('issuer', v)} placeholder="e.g. Google, Shopify, HubSpot" />
            <MonthYearInput label="Date earned" value={c.date} onChange={(v) => set('date', v)} />
            <TextField
              label="Credential link"
              value={c.link}
              inputMode="url"
              onValue={(v) => set('link', v)}
              onBlur={() => setTouched((t) => ({ ...t, [c.id]: true }))}
              error={touched[c.id] && !check.ok ? check.message : undefined}
            />
          </div>
        );
      }}
    />
  );
}

export function AchievementsEditor() {
  return (
    <EntryList
      section="achievements"
      singular="achievement"
      addLabel="Add achievement"
      empty="No achievements yet. Awards, rankings, publications or notable results."
      newItem={() => ({ id: uid('ach'), text: '' })}
      title={(a) => clean(a.text).slice(0, 70) || 'Untitled achievement'}
      fields={(a, set) => (
        <div>
          <TextArea label="Achievement" rows={2} value={a.text} onValue={(v) => set('text', v)} />
          <BulletHints text={a.text} />
        </div>
      )}
    />
  );
}

export function LanguagesEditor() {
  return (
    <EntryList
      section="languages"
      singular="language"
      addLabel="Add language"
      empty="Optional. Add spoken languages if relevant to the role."
      newItem={() => ({ id: uid('lang'), name: '', proficiency: '' })}
      title={(l) => clean(l.name) || 'Untitled language'}
      meta={(l) => clean(l.proficiency)}
      fields={(l, set) => (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Language" value={l.name} onValue={(v) => set('name', v)} />
          <TextField
            label="Proficiency"
            value={l.proficiency}
            onValue={(v) => set('proficiency', v)}
            placeholder="Native, Fluent, Professional"
          />
        </div>
      )}
    />
  );
}
