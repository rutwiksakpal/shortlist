import { lazy, Suspense, useEffect } from 'react';
import { parseHash, paths, useHash, type Route } from './router';
import { startAutosave, useStore } from './store/useStore';
import { useTheme, watchSystemTheme, applyTheme } from './store/theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UiHost } from './components/UiHost';
import { MonitorIcon, MoonIcon, SunIcon } from './components/icons';
import { Button, EmptyState, IconButton, Notice, Spinner } from './components/ui';
import { cx, FOCUS_RING } from './components/cx';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { SettingsPage } from './pages/SettingsPage';

const EditorPage = lazy(() => import('./pages/EditorPage').then((m) => ({ default: m.EditorPage })));
const ReviewPage = lazy(() => import('./pages/ReviewPage').then((m) => ({ default: m.ReviewPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })));

const NAV: Array<{ label: string; href: string; match: Route['name'][] }> = [
  { label: 'Resumes', href: paths.dashboard(), match: ['dashboard', 'editor', 'review'] },
  { label: 'Applications', href: paths.applications(), match: ['applications'] },
  { label: 'Import', href: paths.import(), match: ['import'] },
  { label: 'Settings', href: paths.settings(), match: ['settings'] },
];

function isTextInput(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      // Inside dialogs (e.g. forms) let the browser handle undo natively.
      if (document.activeElement?.closest('dialog')) return;
      if (key === 'z' && !e.shiftKey) {
        if (isTextInput(document.activeElement) && !useStore.getState().canUndo()) return;
        e.preventDefault();
        useStore.getState().undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        useStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
  return (
    <IconButton label={`Theme: ${theme}. Switch to ${next}`} onClick={() => setTheme(next)}>
      {theme === 'light' ? <SunIcon /> : theme === 'dark' ? <MoonIcon /> : <MonitorIcon />}
    </IconButton>
  );
}

function RecoveryBanner() {
  const recovery = useStore((s) => s.recovery);
  const dismiss = useStore((s) => s.dismissRecovery);
  if (!recovery) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <Notice
        tone="warn"
        title="Your saved data could not be read, so Shortlist started fresh."
        action={
          <span className="flex gap-2">
            <Button size="sm" onClick={() => (window.location.hash = paths.settings())}>
              Open recovered data
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
          </span>
        }
      >
        The unreadable data was kept, not deleted. You can download it from Settings. Reason: {recovery.reason}
      </Notice>
    </div>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />;
    case 'editor':
      return <EditorPage id={route.id} />;
    case 'review':
      return <ReviewPage id={route.id} />;
    case 'import':
      return <ImportPage />;
    case 'applications':
      return <ApplicationsPage />;
    case 'settings':
      return <SettingsPage />;
    case 'notFound':
      return (
        <div className="mx-auto w-full max-w-xl p-6">
          <EmptyState
            title="Page not found"
            action={<Button onClick={() => (window.location.hash = paths.dashboard())}>Go to resumes</Button>}
          />
        </div>
      );
  }
}

const TITLES: Record<Route['name'], string> = {
  dashboard: 'Resumes',
  editor: 'Editor',
  review: 'Review and download',
  import: 'Import',
  applications: 'Applications',
  settings: 'Settings',
  notFound: 'Not found',
};

export function App() {
  const hash = useHash();
  const route = parseHash(hash);
  const theme = useTheme((s) => s.theme);
  useEffect(() => startAutosave(), []);
  useEffect(() => {
    applyTheme(theme);
    return watchSystemTheme();
  }, [theme]);
  useEffect(() => {
    document.title = `${TITLES[route.name]} - Shortlist`;
    if (route.name !== 'editor') window.scrollTo(0, 0);
  }, [route.name]);
  useGlobalShortcuts();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only z-50 rounded bg-indigo-600 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-4 px-3 sm:px-4">
          <a href={paths.dashboard()} className={cx('flex items-center gap-2 rounded', FOCUS_RING)} aria-label="Shortlist home">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-bold">Shortlist</span>
              <span className="hidden text-[11px] text-slate-500 sm:block dark:text-slate-400">ATS Resume Studio</span>
            </span>
          </a>
          <nav aria-label="Main" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {NAV.map((n) => {
              const active = n.match.includes(route.name);
              return (
                <a
                  key={n.href}
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium',
                    FOCUS_RING,
                    active
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  {n.label}
                </a>
              );
            })}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <RecoveryBanner />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <ErrorBoundary resetKey={hash}>
          <Suspense
            fallback={
              <div className="w-full p-8">
                <Spinner />
              </div>
            }
          >
            <Page route={route} />
          </Suspense>
        </ErrorBoundary>
      </main>
      <UiHost />
    </div>
  );
}
