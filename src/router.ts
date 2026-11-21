import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'editor'; id: string }
  | { name: 'review'; id: string }
  | { name: 'import' }
  | { name: 'applications' }
  | { name: 'settings' }
  | { name: 'notFound'; path: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'dashboard' };
  if (parts[0] === 'resume' && parts[1]) {
    if (parts.length === 2) return { name: 'editor', id: parts[1] };
    if (parts.length === 3 && parts[2] === 'review') return { name: 'review', id: parts[1] };
  }
  if (parts.length === 1 && parts[0] === 'import') return { name: 'import' };
  if (parts.length === 1 && parts[0] === 'applications') return { name: 'applications' };
  if (parts.length === 1 && parts[0] === 'settings') return { name: 'settings' };
  return { name: 'notFound', path };
}

export const paths = {
  dashboard: () => '#/',
  editor: (id: string) => `#/resume/${encodeURIComponent(id)}`,
  review: (id: string) => `#/resume/${encodeURIComponent(id)}/review`,
  import: () => '#/import',
  applications: () => '#/applications',
  settings: () => '#/settings',
};

export function navigate(hash: string): void {
  if (window.location.hash !== hash) window.location.hash = hash;
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => '',
  );
}
