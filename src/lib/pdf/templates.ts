import type { TemplateId } from '../schema';

export interface TemplateStyle {
  id: TemplateId;
  name: string;
  description: string;
  regular: 'Helvetica' | 'Times-Roman';
  bold: 'Helvetica-Bold' | 'Times-Bold';
  headerAlign: 'left' | 'center';
  uppercaseHeadings: boolean;
  headingLetterSpacing: number;
  nameSize: number;
}

/**
 * ATS-safe templates. Every template is single column, text only, black on white, with
 * standard fonts and standard headings. Only typography and alignment differ.
 */
export const TEMPLATES: Record<TemplateId, TemplateStyle> = {
  simple: {
    id: 'simple',
    name: 'Simple',
    description: 'Clean and minimal. Title-case headings, Helvetica.',
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    headerAlign: 'left',
    uppercaseHeadings: false,
    headingLetterSpacing: 0,
    nameSize: 20,
  },
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional uppercase headings, Helvetica.',
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    headerAlign: 'left',
    uppercaseHeadings: true,
    headingLetterSpacing: 0,
    nameSize: 20,
  },
  centered: {
    id: 'centered',
    name: 'Centered',
    description: 'Centered name and contact line, spaced uppercase headings.',
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    headerAlign: 'center',
    uppercaseHeadings: true,
    headingLetterSpacing: 0.6,
    nameSize: 22,
  },
  serif: {
    id: 'serif',
    name: 'Serif',
    description: 'Times font for a formal look. Good for academic and corporate roles.',
    regular: 'Times-Roman',
    bold: 'Times-Bold',
    headerAlign: 'left',
    uppercaseHeadings: false,
    headingLetterSpacing: 0,
    nameSize: 21,
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);
