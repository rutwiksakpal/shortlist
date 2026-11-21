import { Component, type ErrorInfo, type ReactNode } from 'react';
import { makeBackup } from '../lib/storage';
import { downloadBlob, todayIsoDate } from '../lib/utils';
import { useStore } from '../store/useStore';

interface Props {
  children: ReactNode;
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Shortlist crashed:', error, info.componentStack);
  }

  override componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  private backup = () => {
    try {
      const s = useStore.getState();
      downloadBlob(
        new Blob([JSON.stringify(makeBackup(s.workspace(), s.snapshots), null, 2)], { type: 'application/json' }),
        `shortlist-backup-${todayIsoDate()}.json`,
      );
    } catch (e) {
      console.error(e);
    }
  };

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg space-y-3 p-6">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This screen hit an unexpected error. Your data is saved in this browser. Download a backup to be safe, then reload.
        </p>
        <pre className="overflow-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">{this.state.error.message}</pre>
        <div className="flex gap-2">
          <button type="button" onClick={this.backup} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">
            Download backup
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/';
              this.setState({ error: null });
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Go to resumes
          </button>
        </div>
      </div>
    );
  }
}
