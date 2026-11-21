import { useStore } from '../store/useStore';
import { AlertIcon, CheckIcon } from './icons';

export function SaveIndicator() {
  const status = useStore((s) => s.saveStatus);
  const dirty = useStore((s) => s.dirty);
  let content;
  if (status.state === 'error') {
    content = (
      <span className="flex items-center gap-1 text-red-600 dark:text-red-400" title={status.message}>
        <AlertIcon size={14} /> Not saved
      </span>
    );
  } else if (dirty || status.state === 'saving') {
    content = <span className="text-slate-500">Saving...</span>;
  } else if (status.state === 'saved') {
    content = (
      <span className="flex items-center gap-1 text-slate-500">
        <CheckIcon size={14} className="text-emerald-600" /> Saved
      </span>
    );
  } else {
    content = <span className="text-slate-500">All changes saved locally</span>;
  }
  return (
    <span role="status" aria-live="polite" className="text-xs">
      {content}
    </span>
  );
}
