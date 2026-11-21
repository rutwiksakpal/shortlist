let counter = 0;

/** Collision-resistant id for local data. */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIsoDate(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Trimmed, with internal whitespace collapsed. */
export function clean(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function isFilled(value: string | undefined | null): boolean {
  return clean(value).length > 0;
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Build a safe file name segment. */
export function fileSafe(value: string): string {
  return clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function defaultFileName(fullName: string, role: string): string {
  const parts = [fileSafe(fullName) || 'Resume', fileSafe(role), 'Resume'].filter(Boolean);
  // Avoid "..._Resume_Resume" when role already ends with Resume
  const joined = parts.join('_').replace(/_Resume_Resume$/, '_Resume');
  return `${joined}.pdf`;
}

export function ensurePdfExtension(name: string): string {
  const base = clean(name).replace(/[\\/:*?"<>|]+/g, '_');
  if (!base) return 'Resume.pdf';
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function wordCount(text: string): number {
  const t = clean(text);
  return t ? t.split(' ').length : 0;
}
