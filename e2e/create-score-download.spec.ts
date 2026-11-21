import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

test('create a resume, score it and download a text-based PDF', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your resumes' })).toBeVisible();

  // Create
  await page.getByRole('button', { name: 'New resume' }).click();
  await page.getByLabel('Resume name').fill('Shopify Developer');
  await page.getByRole('button', { name: 'Create resume' }).click();
  await expect(page.getByRole('heading', { name: 'Shopify Developer', level: 1 })).toBeVisible();

  // Add an experience entry with a bullet
  await page.getByRole('button', { name: /^Experience/ }).click();
  await page.getByRole('button', { name: 'Add experience' }).click();
  await page.getByLabel('Job title', { exact: true }).fill('Web Developer');
  await page.getByLabel('Company', { exact: true }).fill('Example Studio');
  await page.getByRole('button', { name: 'Add bullet' }).click();
  await page.getByLabel('Bullet 1').fill('Built 12 custom Shopify sections with Liquid, cutting page build time by 40%.');

  // Score
  await page.getByRole('tab', { name: /ATS score/ }).click();
  const panel = page.getByRole('tabpanel');
  await expect(panel.getByText('Keyword match')).toBeVisible();
  await expect(panel.getByText('This is an estimate; real ATS systems vary.')).toBeVisible();
  await expect(panel.getByText(/Text layer verified/).first()).toBeVisible({ timeout: 20_000 });

  // Preview renders a canvas page
  await page.getByRole('tab', { name: /^Preview/ }).click();
  await expect(page.getByRole('img', { name: 'Resume page 1 of 1' })).toBeVisible({ timeout: 20_000 });

  // Review and download
  await page.getByRole('button', { name: /Review and download/ }).click();
  await expect(page.getByText('PASS', { exact: true })).toBeVisible({ timeout: 30_000 });
  const confirm = page.getByLabel('I have reviewed the warnings and want to download anyway');
  if (await confirm.isVisible()) await confirm.check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Rutwik_Sakpal_Shopify_Developer_Resume.pdf');
  const path = await download.path();
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const meta = (await doc.getMetadata()).info as Record<string, unknown>;
  expect(meta.Title).toBe('Rutwik Sakpal - Web Developer');
  expect(meta.Author).toBe('Rutwik Sakpal');
  const content = await (await doc.getPage(1)).getTextContent();
  const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  for (const s of [
    'Rutwik Sakpal',
    'work@codewithrutwik.space',
    'SKILLS',
    'EXPERIENCE',
    'Example Studio',
    'cutting page build time by 40%',
  ]) {
    expect(text).toContain(s);
  }

  expect(errors, errors.join('\n')).toEqual([]);
});
