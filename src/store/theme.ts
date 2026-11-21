import { create } from 'zustand';
import { loadTheme, saveTheme, type ThemePref } from '../lib/storage';

function systemDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function applyTheme(pref: ThemePref): void {
  const dark = pref === 'dark' || (pref === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
}

interface ThemeState {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
}

export const useTheme = create<ThemeState>()((set) => ({
  theme: typeof window === 'undefined' ? 'system' : loadTheme(),
  setTheme: (theme) => {
    saveTheme(theme);
    applyTheme(theme);
    set({ theme });
  },
}));

export function watchSystemTheme(): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (useTheme.getState().theme === 'system') applyTheme('system');
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
