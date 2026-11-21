// Copies pdf.js standard font data into public/ so the browser can render PDF previews offline.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist', 'standard_fonts');
const dest = join(root, 'public', 'pdfjs', 'standard_fonts');
if (!existsSync(src)) {
  console.error('pdfjs-dist standard_fonts not found. Run npm install first.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Copied pdf.js standard fonts to public/pdfjs/standard_fonts');
