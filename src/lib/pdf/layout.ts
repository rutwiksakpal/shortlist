import type { Layout } from '../schema';

export interface Metrics {
  pagePadding: number;
  body: number;
  heading: number;
  name: number;
  headline: number;
  lineHeight: number;
  sectionGap: number;
  headingGap: number;
  entryGap: number;
  bulletGap: number;
  bulletIndent: number;
}

const SPACING = {
  compact: { lineHeight: 1.2, sectionGap: 7, headingGap: 3, entryGap: 4, bulletGap: 1 },
  normal: { lineHeight: 1.3, sectionGap: 10, headingGap: 4, entryGap: 6, bulletGap: 1.5 },
  relaxed: { lineHeight: 1.38, sectionGap: 13, headingGap: 5, entryGap: 8, bulletGap: 2.5 },
} as const;

/**
 * All sizes in PDF points. Body 10-11pt, section headings 12-13pt, margins 0.6-0.8in.
 */
export function metricsFor(layout: Layout): Metrics {
  const sp = SPACING[layout.spacing];
  return {
    pagePadding: layout.margin * 72,
    body: layout.fontSize,
    heading: layout.fontSize + 2,
    name: 20,
    headline: layout.fontSize + 1.5,
    lineHeight: sp.lineHeight,
    sectionGap: sp.sectionGap,
    headingGap: sp.headingGap,
    entryGap: sp.entryGap,
    bulletGap: sp.bulletGap,
    bulletIndent: 11,
  };
}

/** Auto-fit candidates from most comfortable to most compact. All stay within ATS-safe limits. */
export const AUTO_FIT_STEPS: ReadonlyArray<Pick<Layout, 'fontSize' | 'spacing' | 'margin'>> = [
  { fontSize: 11, spacing: 'relaxed', margin: 0.8 },
  { fontSize: 11, spacing: 'normal', margin: 0.8 },
  { fontSize: 11, spacing: 'normal', margin: 0.7 },
  { fontSize: 10.5, spacing: 'normal', margin: 0.7 },
  { fontSize: 10.5, spacing: 'compact', margin: 0.7 },
  { fontSize: 10.5, spacing: 'compact', margin: 0.6 },
  { fontSize: 10, spacing: 'compact', margin: 0.6 },
];
