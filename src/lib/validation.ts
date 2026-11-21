import { clean } from './utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(clean(value));
}

/** Accepts +, digits, spaces, dashes, dots and parentheses with 7-15 digits (E.164 length). */
export function isValidPhone(value: string): boolean {
  const v = clean(value);
  if (!/^\+?[0-9 ().-]+$/.test(v)) return false;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

/** Accepts URLs with or without protocol, e.g. "github.com/user" or "https://site.dev". */
export function isValidUrl(value: string): boolean {
  const v = clean(value);
  if (!v || /\s/.test(v)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
}

/** Full clickable URL. */
export function toHref(value: string): string {
  const v = clean(value);
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Visible plain-text form: no protocol, no "www.", no trailing slash. */
export function displayUrl(value: string): string {
  return clean(value)
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

export type FieldCheck = { ok: true } | { ok: false; message: string };

export function checkEmail(value: string): FieldCheck {
  if (!clean(value)) return { ok: true };
  return isValidEmail(value) ? { ok: true } : { ok: false, message: 'Enter a valid email, e.g. name@domain.com' };
}

export function checkPhone(value: string): FieldCheck {
  if (!clean(value)) return { ok: true };
  return isValidPhone(value) ? { ok: true } : { ok: false, message: 'Enter a valid phone with country code, e.g. +91 98765 43210' };
}

export function checkUrl(value: string): FieldCheck {
  if (!clean(value)) return { ok: true };
  return isValidUrl(value) ? { ok: true } : { ok: false, message: 'Enter a valid web address, e.g. github.com/username' };
}
