import { useUi } from '../store/ui';
import { Dialog } from './Dialog';
import { XIcon } from './icons';
import { Button, IconButton } from './ui';
import { cx } from './cx';

/** Renders the global confirm dialog and toasts. */
export function UiHost() {
  const confirm = useUi((s) => s.confirm);
  const answer = useUi((s) => s.answer);
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <>
      <Dialog
        open={confirm !== null}
        onClose={() => answer(false)}
        title={confirm?.title ?? ''}
        size="sm"
        description={confirm?.message}
        footer={
          <>
            <Button onClick={() => answer(false)}>Cancel</Button>
            <Button variant={confirm?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => answer(true)} autoFocus>
              {confirm?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      />
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cx(
              'pointer-events-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white shadow-lg',
              t.tone === 'error' ? 'bg-red-600' : t.tone === 'info' ? 'bg-slate-800' : 'bg-emerald-600',
            )}
          >
            <span>{t.message}</span>
            <IconButton label="Dismiss" onClick={() => dismiss(t.id)} className="h-6 w-6 text-white hover:bg-white/20 hover:text-white">
              <XIcon size={14} />
            </IconButton>
          </div>
        ))}
      </div>
    </>
  );
}
