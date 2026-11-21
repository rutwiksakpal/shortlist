import { useEffect, useMemo } from 'react';
import { resolveResume } from '../lib/resolve';
import { scoreResume } from '../lib/score';
import { useScoreCache } from '../store/scoreCache';
import { useStore, useVariant } from '../store/useStore';
import { readyOf, usePdfBuild } from './preview/usePdfBuild';

/** Resolved resume + live PDF build + score for one variant. */
export function useResume(variantId: string) {
  const profile = useStore((s) => s.profile);
  const variant = useVariant(variantId);
  const fallback = useStore((s) => s.variants[0]!);
  const v = variant ?? fallback;
  const resume = useMemo(() => resolveResume(profile, v), [profile, v]);
  const build = usePdfBuild(resume, v.layout);
  const ready = readyOf(build);
  const fresh = build.status === 'ready';
  const score = useMemo(
    () => scoreResume({ profile, variant: v, resume, pages: ready?.pages ?? null, verify: ready?.verify ?? null }),
    [profile, v, resume, ready],
  );
  const setScore = useScoreCache((s) => s.setScore);
  useEffect(() => {
    if (fresh && variant) setScore(variant.id, score.total);
  }, [fresh, score.total, variant, setScore]);
  return { profile, variant, resume, build, ready, fresh, score };
}
