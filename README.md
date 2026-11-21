# Shortlist - ATS Resume Studio

A personal, browser-only resume builder. Keep one master profile, create role-targeted resumes, score them for ATS compatibility (optionally against a pasted job description), and download a clean, text-based PDF.

No backend, no login, no external API calls. All data stays in your browser's localStorage.

## Run, build, test

Requires Node.js 20 or newer.

```bash
npm install          # install dependencies
npm run dev          # start at http://localhost:5173
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build
npm run typecheck    # TypeScript (strict)
npm run lint         # ESLint, zero warnings allowed
npm test             # Vitest unit + component tests
npm run test:e2e     # Playwright: create, score, download (builds first)
npm run check        # typecheck + lint + tests + build
npm run icons        # regenerate PNG icons from public/favicon.svg
```

The first `npm run test:e2e` needs a browser: run `npx playwright install chromium`, or point at an installed Chrome with `PW_CHROME_PATH=/path/to/chrome npm run test:e2e`.

## Deploy (GitHub + Vercel)

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New > Project**, then import the repository.
3. Vercel detects Vite automatically (`vercel.json` is included). The build command is `npm run build` and the output directory is `dist`. No environment variables are needed.
4. Deploy. Every push to `main` redeploys.

Routing uses URL hashes (`#/resume/...`), so no rewrite rules are needed.

## How it is organised

| Path                                                     | What it does                                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/lib/schema.ts`                                      | Zod data model. Strict: no fields for DOB, age, gender, marital status, nationality, religion, photo or street address |
| `src/lib/resolve.ts`                                     | Turns master profile + variant into exactly what is printed. Enforces the **no empty output** rule                     |
| `src/lib/pdf/`                                           | `@react-pdf/renderer` document (Helvetica, single column), auto-fit, pdf.js text-layer verification                    |
| `src/lib/score.ts`, `jd.ts`, `keywords.ts`, `bullets.ts` | Deterministic ATS score, job description analysis, keyword library with synonyms, bullet helper                        |
| `src/lib/import/`                                        | PDF/DOCX/text/JSON import, best-effort section mapping, sensitive-data stripping                                       |
| `src/store/`                                             | Zustand store: undo/redo, autosave, version history (20 snapshots), variants, applications                             |
| `src/pages/`, `src/features/`                            | UI                                                                                                                     |

The live preview is the **real PDF** rendered by pdf.js, so the preview, page count, score and download always match.

## Manual acceptance checklist

1. Open the app. The dashboard shows **Web Developer** and **Software Developer** with the seed data. Experience, projects and education are empty.
2. Open **Web Developer**. The preview shows name, headline, contact line and Skills only. There are no empty headings, no "N/A" and no stray `|`.
3. Add an experience with one bullet "Responsible for website". Bullet hints warn about a weak opener, a missing metric and short length. Nothing is rewritten for you.
4. Set the end date before the start date. An error appears. Tick "I currently work here" and the preview shows `Mon YYYY - Present`.
5. Hide that experience with the eye button. It disappears from the preview, and the Software Developer resume is unaffected.
6. Drag sections in **Section order and visibility** (mouse, or keyboard: Tab to a handle, Space, arrow keys, Space). The preview order follows.
7. Press Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Undo and redo work. The header shows "Saved".
8. **Page and layout**: switch to US Letter, then click **Auto-fit**. It reports the page count and the settings it chose.
9. **ATS score** tab: score out of 100 with 7 categories, fixes, matched and missing keywords, and the note "This is an estimate; real ATS systems vary."
10. Paste a job description into **Target role**. Keyword match now uses it, and the analysis shows the job title, years asked, hard skills and tools.
11. Write "Shopify" 8 times in the summary. The keyword stuffing warning appears and the score drops.
12. **ATS text view** shows the extracted text in reading order.
13. **Review and download**: the checklist and text-layer check show PASS. If there are warnings, the Download button needs the confirm tick. The file downloads as `Rutwik_Sakpal_Web_Developer_Resume.pdf`. Open it and select text to confirm it is real text. Document properties show Title "Rutwik Sakpal - Web Developer" and Author "Rutwik Sakpal".
14. After downloading, click **Log application**. It appears under **Applications**, where you can change its status.
15. Dashboard: **Tailor for job** creates a copy with the job description. Duplicate, rename, delete, search and tag filters all work.
16. **Import**: paste a resume that contains "Date of Birth: ..." and a street address. The review screen lists them as removed. Unknown lines (e.g. Hobbies) are listed for you to assign. **Create resume** opens the editor.
17. **Version history**: click **Save version now**, make a change, then **Restore**.
18. **Settings**: export JSON, change something, then import the JSON to get your data back. Toggle dark mode.
19. Resize to phone width. The editor shows Edit, Preview, Score and ATS text tabs.

## Limitations (honest)

- **Data lives in one browser.** Clearing site data, private windows or switching devices means starting empty. Export a JSON backup regularly.
- **The ATS score is an estimate.** It is a local, rule-based heuristic. Real ATS products parse and rank differently.
- **Import is best-effort.** Single-column resumes map well. Multi-column or heavily designed PDFs may mix lines and need fixing on the review screen. Scanned (image-only) PDFs have no text to read. Old `.doc` files are not supported.
- **Keyword library.** Synonym matching covers about 100 common web and software terms. Unknown terms in a job description are not detected as skills.
- **"Links work" is a format check.** No network requests are made, so open each link from the Review screen to confirm it.
- **Fonts.** The PDF uses standard Helvetica (no embedded fonts). Characters outside the Latin-1 set (emoji, ₹, arrows) are converted or removed, and the score flags this.
- **Large first load of the editor.** The PDF engine (about 1.2 MB) loads lazily the first time you open a resume.
