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
  await expect(page.getByRole('heading', { name: 'Get past the resume filter.' })).toBeVisible();

  // Onboarding
  await page.getByRole('link', { name: 'Build my resume' }).click();
  await page.getByLabel('Full name').fill('Rutwik Sakpal');
  await page.getByLabel('Job title you are aiming for').fill('Shopify Developer');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Email').fill('work@example.dev');
  await page.getByLabel('Phone (optional)').fill('+91 90000 12345');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Create my resume' }).click();
  await expect(page.getByRole('heading', { name: 'Shopify Developer', level: 1 })).toBeVisible();

  // Skills
  await page.getByRole('button', { name: /^Skills/ }).click();
  await page.getByRole('button', { name: 'Add skill group' }).click();
  await page.getByLabel('Group name').fill('Platforms');
  await page.getByLabel('Add skills to Platforms').fill('Shopify, Liquid, JavaScript');
  await page.getByLabel('Add skills to Platforms').press('Enter');

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
  expect(meta.Title).toBe('Rutwik Sakpal - Shopify Developer');
  expect(meta.Author).toBe('Rutwik Sakpal');
  const content = await (await doc.getPage(1)).getTextContent();
  const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ');
  for (const s of [
    'Rutwik Sakpal',
    'work@example.dev',
    'Skills',
    'Experience',
    'Platforms:',
    'Shopify, Liquid, JavaScript',
    'Example Studio',
    'cutting page build time by 40%',
  ]) {
    expect(text).toContain(s);
  }

  // Cover letter
  await page.goto(page.url().replace('/review', '/cover-letter'));
  await page.getByLabel('Company').fill('Acme');
  await page
    .getByLabel('Body')
    .fill(
      'I am applying for the Shopify Developer role at Acme.\n\nI built 12 custom sections that cut build time by 40%.\n\nThank you for your time.',
    );
  await expect(page.getByText(/Most cover letters are 250-400 words/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download cover letter' })).toBeDisabled();
  await page.getByLabel('Download anyway').check();
  await expect(page.getByRole('button', { name: 'Download cover letter' })).toBeEnabled({ timeout: 20_000 });
  const letterDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download cover letter' }).click();
  expect((await letterDownload).suggestedFilename()).toBe('Rutwik_Sakpal_Acme_Cover_Letter.pdf');

  expect(errors, errors.join('\n')).toEqual([]);
});
