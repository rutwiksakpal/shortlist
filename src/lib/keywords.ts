/**
 * Keyword dictionary with synonyms. Every term has a canonical name and aliases.
 * Matching is case-insensitive and boundary-aware ("js" will not match inside "node.js").
 */

export type TermKind = 'skill' | 'tool';

export interface Term {
  canonical: string;
  aliases: string[];
  kind: TermKind;
  /** Umbrella terms the user may have listed that commonly include this one (e.g. MERN -> React). */
  impliedBy?: string[];
  /** Aliases are matched with exact casing (avoids "react to", "express interest"). */
  caseSensitive?: boolean;
  /** For job-description extraction only: at least one of these terms must also appear. */
  requiresContext?: string[];
}

const T = (canonical: string, aliases: string[] = [], kind: TermKind = 'skill', impliedBy?: string[]): Term => ({
  canonical,
  aliases,
  kind,
  ...(impliedBy ? { impliedBy } : {}),
});

export const DICTIONARY: Term[] = [
  // Languages
  T('JavaScript', ['js', 'javascript', 'ecmascript', 'es6', 'es2015']),
  T('TypeScript', ['ts', 'typescript']),
  T('HTML', ['html5', 'html']),
  T('CSS', ['css3', 'css']),
  T('Python', ['python', 'python3']),
  T('Java', ['java']),
  T('C++', ['c++', 'cpp']),
  T('C#', ['c#', 'csharp']),
  T('PHP', ['php']),
  T('SQL', ['sql']),
  T('Liquid', ['liquid', 'shopify liquid'], 'skill', ['Shopify/Liquid']),
  // Frameworks / runtimes
  {
    canonical: 'React',
    aliases: ['React', 'React.js', 'ReactJS', 'React JS', 'REACT', 'react.js', 'reactjs'],
    kind: 'skill',
    impliedBy: ['MERN'],
    caseSensitive: true,
  },
  T('Node.js', ['node', 'node.js', 'nodejs', 'node js'], 'skill', ['MERN']),
  {
    canonical: 'Express',
    aliases: ['Express', 'Express.js', 'ExpressJS', 'express.js', 'expressjs', 'EXPRESS'],
    kind: 'skill',
    impliedBy: ['MERN'],
    caseSensitive: true,
    requiresContext: ['Node.js', 'MERN', 'JavaScript', 'MongoDB', 'REST APIs'],
  },
  T('MongoDB', ['mongodb', 'mongo', 'mongo db', 'mongoose'], 'tool', ['MERN']),
  T('MERN', ['mern', 'mern stack']),
  T('Next.js', ['next.js', 'nextjs', 'next js']),
  T('Vue', ['vue', 'vue.js', 'vuejs']),
  T('Angular', ['angular', 'angularjs']),
  T('Redux', ['redux', 'redux toolkit', 'rtk']),
  T('Tailwind CSS', ['tailwind', 'tailwindcss', 'tailwind css']),
  T('Bootstrap', ['bootstrap']),
  T('Sass', ['sass', 'scss']),
  T('jQuery', ['jquery']),
  T('Laravel', ['laravel']),
  T('Django', ['django']),
  T('Spring Boot', ['spring boot', 'springboot']),
  T('GraphQL', ['graphql']),
  T('REST APIs', ['rest api', 'rest apis', 'restful', 'restful api', 'restful apis']),
  T('APIs', ['api', 'apis', 'api integration', 'api development']),
  // Databases
  T('PostgreSQL', ['postgresql', 'postgres'], 'tool'),
  T('MySQL', ['mysql'], 'tool'),
  T('Redis', ['redis'], 'tool'),
  T('Firebase', ['firebase'], 'tool'),
  T('Databases', ['database', 'databases', 'dbms', 'data modeling', 'data modelling']),
  // CS fundamentals
  T('Data Structures', ['data structures', 'data structure', 'dsa']),
  T('Algorithms', ['algorithms', 'algorithm', 'dsa']),
  T('System Design', ['system design', 'systems design', 'low level design', 'high level design', 'lld', 'hld']),
  T('OOP', ['oop', 'object oriented programming', 'object-oriented programming', 'object-oriented']),
  T('Microservices', ['microservices', 'microservice']),
  // Tooling
  T('Git', ['git', 'version control'], 'tool'),
  T('GitHub', ['github'], 'tool'),
  T('Testing', ['testing', 'unit testing', 'unit tests', 'integration testing', 'test automation', 'automated testing']),
  T('Jest', ['jest'], 'tool'),
  T('Vitest', ['vitest'], 'tool'),
  T('Cypress', ['cypress'], 'tool'),
  T('Playwright', ['playwright'], 'tool'),
  T('CI/CD', ['ci/cd', 'ci cd', 'cicd', 'continuous integration', 'continuous deployment', 'continuous delivery']),
  T('GitHub Actions', ['github actions'], 'tool'),
  T('Docker', ['docker', 'containerization'], 'tool'),
  T('Kubernetes', ['kubernetes', 'k8s'], 'tool'),
  T('AWS', ['aws', 'amazon web services'], 'tool'),
  T('Azure', ['azure', 'microsoft azure'], 'tool'),
  T('GCP', ['gcp', 'google cloud', 'google cloud platform'], 'tool'),
  T('Vercel', ['vercel'], 'tool'),
  T('Netlify', ['netlify'], 'tool'),
  T('Linux', ['linux', 'unix'], 'tool'),
  T('Webpack', ['webpack'], 'tool'),
  T('Vite', ['vite'], 'tool'),
  T('Figma', ['figma'], 'tool'),
  T('Jira', ['jira'], 'tool'),
  T('Agile', ['agile', 'scrum', 'kanban']),
  T('Postman', ['postman'], 'tool'),
  // CMS / ecommerce
  T('WordPress', ['wordpress'], 'tool', ['WordPress/Elementor']),
  T('Elementor', ['elementor', 'elementor pro'], 'tool', ['WordPress/Elementor']),
  T('WooCommerce', ['woocommerce'], 'tool'),
  T('Shopify', ['shopify', 'shopify plus'], 'tool', ['Shopify/Liquid']),
  T('Shopify Theme Development', [
    'shopify theme development',
    'shopify themes',
    'theme development',
    'online store 2.0',
    'os 2.0',
    'dawn theme',
  ]),
  T('Shopify Apps', ['shopify apps', 'shopify app', 'shopify app development', 'shopify custom app']),
  T('Custom Sections', ['custom sections', 'custom section', 'section schema']),
  T('GoHighLevel', ['gohighlevel', 'go high level', 'highlevel', 'ghl'], 'tool'),
  T('HubSpot', ['hubspot'], 'tool'),
  T('Webflow', ['webflow'], 'tool'),
  T('Klaviyo', ['klaviyo'], 'tool'),
  T('Zapier', ['zapier'], 'tool'),
  // SEO / performance
  T('SEO', ['seo', 'search engine optimization', 'search engine optimisation']),
  T('Technical SEO', ['technical seo']),
  T('On-page SEO', ['on-page seo', 'on page seo', 'onpage seo']),
  T('Core Web Vitals', ['core web vitals', 'cwv', 'lcp', 'cls', 'inp']),
  T('Site Speed', [
    'site speed',
    'page speed',
    'pagespeed',
    'website speed',
    'performance optimization',
    'performance optimisation',
    'web performance',
  ]),
  T('Lighthouse', ['lighthouse'], 'tool'),
  T('Google Search Console', ['google search console', 'search console', 'gsc'], 'tool'),
  T('Schema Markup', ['schema markup', 'structured data', 'json-ld']),
  T('Ahrefs', ['ahrefs'], 'tool'),
  T('SEMrush', ['semrush'], 'tool'),
  // Marketing / analytics
  T('GA4', ['ga4', 'google analytics 4', 'google analytics'], 'tool'),
  T('Google Tag Manager', ['google tag manager', 'gtm', 'tag manager'], 'tool'),
  T('Meta Ads', ['meta ads', 'facebook ads', 'instagram ads', 'meta pixel', 'facebook pixel'], 'tool'),
  T('Google Ads', ['google ads', 'adwords', 'google adwords'], 'tool'),
  T('Conversion Tracking', ['conversion tracking', 'conversions api', 'capi', 'event tracking']),
  T('Performance Marketing', ['performance marketing', 'paid media', 'paid ads']),
  T('Accessibility', ['accessibility', 'a11y', 'wcag']),
  T('Responsive Design', ['responsive design', 'responsive web design', 'mobile-first', 'mobile first']),
  T('UI/UX', ['ui/ux', 'ux', 'ui design', 'user experience']),
];

const BY_CANONICAL = new Map(DICTIONARY.map((t) => [t.canonical.toLowerCase(), t]));

export function findTerm(name: string): Term | undefined {
  const key = name.trim().toLowerCase();
  const direct = BY_CANONICAL.get(key);
  if (direct) return direct;
  return DICTIONARY.find((t) => t.aliases.some((a) => a.toLowerCase() === key));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Boundary-aware regex. A match may not be glued to letters/digits, and may not be the
 * tail of a dotted token (so "js" does not match in "node.js") or the head of one.
 */
export function aliasRegex(alias: string, caseSensitive = false): RegExp {
  const body = escapeRegex(caseSensitive ? alias : alias.toLowerCase()).replace(/ /g, '\\s+');
  return new RegExp(`(?<![A-Za-z0-9+#]|[A-Za-z0-9]\\.)${body}(?![A-Za-z0-9+#]|\\.[A-Za-z0-9])`, caseSensitive ? 'g' : 'gi');
}

const regexCache = new Map<string, RegExp[]>();

function termRegexes(term: Term): RegExp[] {
  const cached = regexCache.get(term.canonical);
  if (cached) return cached;
  const all = term.caseSensitive
    ? Array.from(new Set([term.canonical, ...term.aliases]))
    : Array.from(new Set([term.canonical.toLowerCase(), ...term.aliases.map((a) => a.toLowerCase())]));
  const list = all.map((a) => aliasRegex(a, term.caseSensitive));
  regexCache.set(term.canonical, list);
  return list;
}

/** Ad-hoc term for a custom keyword not in the dictionary. */
export function customTerm(keyword: string): Term {
  return findTerm(keyword) ?? { canonical: keyword.trim(), aliases: [keyword.trim().toLowerCase()], kind: 'skill' };
}

/** Number of non-overlapping occurrences of a term (any alias) in text. */
export function countTerm(term: Term, text: string): number {
  const lower = term.caseSensitive ? text : text.toLowerCase();
  const spans: Array<[number, number]> = [];
  for (const re of termRegexes(term)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!spans.some(([a, b]) => start < b && end > a)) spans.push([start, end]);
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  return spans.length;
}

export function hasTerm(term: Term, text: string): boolean {
  return countTerm(term, text) > 0;
}

/** All dictionary terms present in a text (context rules applied). */
export function extractTerms(text: string): Term[] {
  const found = DICTIONARY.filter((t) => hasTerm(t, text));
  const names = new Set(found.map((t) => t.canonical));
  return found.filter((t) => !t.requiresContext || t.requiresContext.some((c) => names.has(c)));
}

export interface RolePreset {
  id: 'web' | 'software';
  name: string;
  headline: string;
  keywords: string[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'web',
    name: 'Web Developer',
    headline: 'Web Developer',
    keywords: [
      'React',
      'Node.js',
      'Express',
      'MongoDB',
      'REST APIs',
      'JavaScript',
      'TypeScript',
      'HTML',
      'CSS',
      'WordPress',
      'Elementor',
      'Shopify',
      'Liquid',
      'Shopify Theme Development',
      'Custom Sections',
      'Shopify Apps',
      'SEO',
      'Technical SEO',
      'On-page SEO',
      'Core Web Vitals',
      'Site Speed',
      'GA4',
      'Google Tag Manager',
      'Meta Ads',
      'Google Ads',
      'Conversion Tracking',
      'GoHighLevel',
    ],
  },
  {
    id: 'software',
    name: 'Software Developer',
    headline: 'Software Developer',
    keywords: [
      'MERN',
      'React',
      'Node.js',
      'Express',
      'MongoDB',
      'JavaScript',
      'TypeScript',
      'Data Structures',
      'Algorithms',
      'System Design',
      'REST APIs',
      'Databases',
      'SQL',
      'Git',
      'Testing',
      'CI/CD',
    ],
  },
];

export function presetById(id: string): RolePreset | undefined {
  return ROLE_PRESETS.find((p) => p.id === id);
}
