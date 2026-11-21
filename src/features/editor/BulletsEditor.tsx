import { useRef } from 'react';
import { analyzeBullet, MAX_BULLET_CHARS } from '../../lib/bullets';
import type { Bullet, Profile } from '../../lib/schema';
import { uid } from '../../lib/utils';
import { AlertIcon, PlusIcon } from '../../components/icons';
import { Button } from '../../components/ui';
import { cx } from '../../components/cx';
import { reorderById, useEditor, useOrderedList } from './context';
import { DeleteButton, HideToggle } from './Panel';
import { SortableList } from './SortableList';

type BulletOwner = { kind: 'experience' | 'projects'; id: string };

function findOwner(p: Profile, owner: BulletOwner): { bullets: Bullet[] } | undefined {
  return owner.kind === 'experience' ? p.experience.find((e) => e.id === owner.id) : p.projects.find((e) => e.id === owner.id);
}

export function BulletHints({ text }: { text: string }) {
  const issues = analyzeBullet(text);
  const len = text.trim().length;
  if (!len) return null;
  return (
    <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <ul className="space-y-0.5" aria-label="Bullet suggestions">
        {issues.map((i) => (
          <li key={i.kind} className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
            <AlertIcon size={12} className="mt-0.5 shrink-0" />
            <span>{i.message}</span>
          </li>
        ))}
      </ul>
      <span className={cx('text-xs tabular-nums', len > MAX_BULLET_CHARS ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400')}>
        {len}/{MAX_BULLET_CHARS}
      </span>
    </div>
  );
}

export function BulletsEditor({ owner, bullets }: { owner: BulletOwner; bullets: Bullet[] }) {
  const { edit } = useEditor();
  const listRef = useRef<HTMLDivElement>(null);
  const byId = new Map(bullets.map((b) => [b.id, b]));
  const list = useOrderedList(
    `bullets:${owner.id}`,
    bullets.map((b) => b.id),
    (ids) =>
      edit(`reorder:bullets:${owner.id}:${Date.now()}`, (p) => {
        const o = findOwner(p, owner);
        if (o) o.bullets = reorderById(o.bullets, ids);
      }),
  );

  const add = () => {
    const id = uid('b');
    edit(`add:bullet:${id}`, (p) => {
      findOwner(p, owner)?.bullets.push({ id, text: '' });
    });
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLTextAreaElement>(`textarea[data-bullet="${id}"]`);
      el?.focus();
    });
  };

  return (
    <div ref={listRef}>
      <p className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-300">Bullet points</p>
      {list.entries.length ? (
        <SortableList
          ariaLabel="Bullet points"
          entries={list.entries}
          onReorder={list.reorder}
          itemLabel={(id) => `bullet "${(byId.get(id)?.text ?? '').slice(0, 30)}"`}
          className="space-y-2"
          render={({ id, hidden, handle, index }) => {
            const b = byId.get(id);
            if (!b) return null;
            return (
              <div className={cx('rounded-lg', hidden && 'opacity-60')}>
                <div className="flex items-start gap-1">
                  <div className="pt-1">{handle}</div>
                  <label htmlFor={`bullet-${id}`} className="sr-only">
                    Bullet {index + 1}
                  </label>
                  <textarea
                    id={`bullet-${id}`}
                    data-bullet={id}
                    rows={2}
                    value={b.text}
                    placeholder="Start with an action verb and include a real result, e.g. Reduced page load time by 35%..."
                    onChange={(e) => {
                      const v = e.target.value;
                      edit(`bullet:${id}`, (p) => {
                        const target = findOwner(p, owner)?.bullets.find((x) => x.id === id);
                        if (target) target.text = v;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        add();
                      }
                    }}
                    className="block min-h-[3.25rem] w-full flex-1 resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <div className="flex flex-col">
                    {list.toggle ? <HideToggle hidden={hidden} label="this bullet" onToggle={() => list.toggle?.(id)} /> : null}
                    <DeleteButton
                      label="this bullet"
                      onClick={() =>
                        edit(`del:bullet:${id}`, (p) => {
                          const o = findOwner(p, owner);
                          if (o) o.bullets = o.bullets.filter((x) => x.id !== id);
                        })
                      }
                    />
                  </div>
                </div>
                <div className="ml-7 mr-9">
                  <BulletHints text={b.text} />
                </div>
              </div>
            );
          }}
        />
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">No bullets yet. Add 3-5 achievements with real results.</p>
      )}
      <Button size="sm" variant="ghost" className="mt-2" icon={<PlusIcon size={16} />} onClick={add}>
        Add bullet
      </Button>
      <p className="mt-1 text-xs text-slate-400">Tip: Ctrl/Cmd + Enter adds another bullet.</p>
    </div>
  );
}
