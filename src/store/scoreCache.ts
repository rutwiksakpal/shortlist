import { create } from 'zustand';

const KEY = 'shortlist:scores:v1';

function load(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
  } catch {
    return {};
  }
}

interface ScoreCache {
  scores: Record<string, number>;
  setScore: (variantId: string, score: number) => void;
}

/** Last full ATS score per resume, shown on the dashboard. */
export const useScoreCache = create<ScoreCache>()((set, get) => ({
  scores: typeof window === 'undefined' ? {} : load(),
  setScore: (id, score) => {
    if (get().scores[id] === score) return;
    const scores = { ...get().scores, [id]: score };
    set({ scores });
    try {
      localStorage.setItem(KEY, JSON.stringify(scores));
    } catch {
      // non-critical
    }
  },
}));
