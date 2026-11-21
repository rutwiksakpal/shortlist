/**
 * Text normalisation for the PDF renderer. The standard PDF fonts (Helvetica/Times) use
 * WinAnsi encoding, so characters outside it extract as garbage. We map common characters
 * to safe equivalents and drop everything else (including emoji).
 */

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u2010\u2011\u2012\u2212]/g, '-'],
  [/[\u2013\u2014\u2015]/g, '-'],
  [/[\u2018\u2019\u201A\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u2033]/g, '"'],
  [/\u2026/g, '...'],
  [/[\u2022\u25CF\u25AA\u25A0\u25E6\u2023\u2043\u2219\u00B7\u25CB\u25BA\u25B8\u27A2\u2794\u2713\u2714\u2705]/g, ''],
  [/[\u2192\u21D2\u27F6]/g, '->'],
  [/\u20B9/g, 'INR '],
  [/\u2264/g, '<='],
  [/\u2265/g, '>='],
  [/\u00D7/g, 'x'],
  [/[\u00A0\u2007\u202F\u2009\u200A\u2002\u2003]/g, ' '],
  [/[\u200B-\u200D\u2060\uFEFF]/g, ''],
];

// WinAnsi (CP1252) printable set, minus the bullet which we render ourselves.
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”–—˜™š›œžŸ'.split(''));

function isWinAnsi(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return true;
  return WIN_ANSI_EXTRA.has(ch);
}

export interface SanitizeResult {
  text: string;
  removed: string[];
}

export function sanitizeDetailed(input: string): SanitizeResult {
  let text = input.normalize('NFC');
  for (const [re, rep] of REPLACEMENTS) text = text.replace(re, rep);
  const removed: string[] = [];
  let out = '';
  for (const ch of text) {
    if (ch === '\n' || ch === '\t') {
      out += ' ';
    } else if (isWinAnsi(ch)) {
      out += ch;
    } else {
      removed.push(ch);
    }
  }
  return { text: out.replace(/\s+/g, ' ').trim(), removed };
}

export function sanitizeForPdf(input: string): string {
  return sanitizeDetailed(input).text;
}

/** Strip leading bullet characters/numbering a user may have typed or pasted. */
export function stripBulletPrefix(text: string): string {
  return text.replace(/^\s*(?:[-*•●▪◦‣⁃–—>]+|\d{1,2}[.)])\s+/, '').trim();
}
