import { describe, expect, it } from 'vitest';
import { extractRange, formatDate, formatRange, parseLooseDate, validateRange } from '../src/lib/dates';
import { isValidEmail, isValidPhone, isValidUrl, displayUrl } from '../src/lib/validation';
import { defaultFileName, ensurePdfExtension } from '../src/lib/utils';

describe('dates', () => {
  it('formats as Mon YYYY - Mon YYYY and never leaves a stray hyphen', () => {
    expect(formatRange('2023-01', 'present')).toBe('Jan 2023 - Present');
    expect(formatRange('2023-01', '2024-06')).toBe('Jan 2023 - Jun 2024');
    expect(formatRange('', '2024-06')).toBe('Jun 2024');
    expect(formatRange('2023-01', '')).toBe('Jan 2023');
    expect(formatRange('', '')).toBe('');
    expect(formatDate('2020')).toBe('2020');
  });
  it('validates end after start and supports Present', () => {
    const now = new Date('2026-11-01');
    expect(validateRange('2023-05', '2023-04', now)?.field).toBe('end');
    expect(validateRange('2023-05', '2023-05', now)).toBeNull();
    expect(validateRange('2023-05', 'present', now)).toBeNull();
    expect(validateRange('2023', '2023-02', now)).toBeNull();
    expect(validateRange('1900-01', '', now)?.field).toBe('start');
  });
  it('parses loose dates from imports', () => {
    expect(parseLooseDate('April 2021')).toBe('2021-04');
    expect(parseLooseDate('Sept. 2020')).toBe('2020-09');
    expect(parseLooseDate('04/2021')).toBe('2021-04');
    expect(parseLooseDate('Current')).toBe('present');
    expect(extractRange('Acme | Jan 2022 – Present')).toEqual({ start: '2022-01', end: 'present', rest: 'Acme' });
  });
});

describe('validation', () => {
  it('checks email, phone and URLs', () => {
    expect(isValidEmail('work@codewithrutwik.space')).toBe(true);
    expect(isValidEmail('nope@x')).toBe(false);
    expect(isValidPhone('+91 9637782385')).toBe(true);
    expect(isValidPhone('12345')).toBe(false);
    expect(isValidUrl('github.com/rutwiksakpal')).toBe(true);
    expect(isValidUrl('https://codewithrutwik.space')).toBe(true);
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(displayUrl('https://www.site.dev/')).toBe('site.dev');
  });
  it('builds file names', () => {
    expect(defaultFileName('Rutwik Sakpal', 'Web Developer')).toBe('Rutwik_Sakpal_Web_Developer_Resume.pdf');
    expect(ensurePdfExtension('My CV')).toBe('My CV.pdf');
  });
});
