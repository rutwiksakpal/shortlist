import { create } from 'zustand';
import { uid } from '../lib/utils';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}

interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface UiState {
  confirm: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  toasts: Toast[];
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  answer: (ok: boolean) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
}

export const useUi = create<UiState>()((set, get) => ({
  confirm: null,
  toasts: [],
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      get().confirm?.resolve(false);
      set({ confirm: { ...opts, resolve } });
    }),
  answer: (ok) => {
    const c = get().confirm;
    set({ confirm: null });
    c?.resolve(ok);
  },
  toast: (message, tone = 'success') => {
    const id = uid('toast');
    set({ toasts: [...get().toasts, { id, message, tone }].slice(-4) });
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const confirmAction = (opts: ConfirmOptions) => useUi.getState().ask(opts);
export const toast = (message: string, tone?: Toast['tone']) => useUi.getState().toast(message, tone);
