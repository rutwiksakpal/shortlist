import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { Fragment, type ReactNode } from 'react';
import { joinFilled, type ContactItem, type ResolvedResume, type ResolvedSection } from '../resolve';
import type { Layout } from '../schema';
import { metricsFor, type Metrics } from './layout';

/**
 * ATS-safe resume document.
 * - Single column, no tables, images, icons, graphics, rules or columns.
 * - Standard Helvetica font, black on white. Contact details live in the body.
 * - Headings are kept with the first block that follows; bullets never split across pages.
 * - Everything rendered comes from a ResolvedResume, which already omits empty content.
 */

const BOLD = 'Helvetica-Bold';
const REGULAR = 'Helvetica';

function makeStyles(m: Metrics) {
  return StyleSheet.create({
    page: {
      paddingTop: m.pagePadding,
      paddingBottom: m.pagePadding,
      paddingHorizontal: m.pagePadding,
      fontFamily: REGULAR,
      fontSize: m.body,
      lineHeight: m.lineHeight,
      color: '#000000',
      backgroundColor: '#FFFFFF',
    },
    name: { fontFamily: BOLD, fontSize: m.name, lineHeight: 1.15 },
    headline: { fontSize: m.headline, marginTop: 2 },
    contact: { marginTop: 3 },
    section: { marginTop: m.sectionGap },
    heading: { fontFamily: BOLD, fontSize: m.heading, marginBottom: m.headingGap, lineHeight: 1.2 },
    entry: { marginTop: m.entryGap },
    firstEntry: { marginTop: 0 },
    bold: { fontFamily: BOLD },
    bulletRow: { flexDirection: 'row', marginTop: m.bulletGap },
    bulletMark: { width: m.bulletIndent },
    bulletText: { flex: 1 },
    link: { color: '#000000', textDecoration: 'none' },
  });
}

type Styles = ReturnType<typeof makeStyles>;

function Bullet({ text, st }: { text: string; st: Styles }) {
  return (
    <View style={st.bulletRow} wrap={false}>
      <Text style={st.bulletMark}>•</Text>
      <Text style={st.bulletText}>{text}</Text>
    </View>
  );
}

function Contact({ items, st }: { items: ContactItem[]; st: Styles }) {
  const parts: ReactNode[] = [];
  items.forEach((c, i) => {
    if (i > 0) parts.push(' | ');
    parts.push(
      c.href ? (
        <Link key={`${c.kind}-${i}`} src={c.href} style={st.link}>
          {c.text}
        </Link>
      ) : (
        c.text
      ),
    );
  });
  return <Text style={st.contact}>{parts}</Text>;
}

interface Segment {
  text: string;
  bold?: boolean;
  href?: string;
}

/** One line of " | " separated parts. Empty parts are dropped, so no stray separators. */
function Segments({ parts, st }: { parts: Segment[]; st: Styles }) {
  const filled = parts.filter((p) => p.text.trim());
  if (!filled.length) return null;
  return (
    <Text>
      {filled.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? ' | ' : ''}
          {p.href ? (
            <Link src={p.href} style={st.link}>
              {p.text}
            </Link>
          ) : p.bold ? (
            <Text style={st.bold}>{p.text}</Text>
          ) : (
            p.text
          )}
        </Fragment>
      ))}
    </Text>
  );
}

/** An entry: header lines kept together with the first bullet, remaining bullets unbreakable. */
function Entry({
  header,
  bullets,
  st,
  first,
  heading,
}: {
  header: ReactNode;
  bullets: string[];
  st: Styles;
  first: boolean;
  heading?: ReactNode;
}) {
  const [head, ...rest] = bullets;
  return (
    <View style={first ? st.firstEntry : st.entry}>
      <View wrap={false}>
        {heading}
        {header}
        {head !== undefined ? <Bullet text={head} st={st} /> : null}
      </View>
      {rest.map((b, i) => (
        <Bullet key={i} text={b} st={st} />
      ))}
    </View>
  );
}

function SectionView({ section, st }: { section: ResolvedSection; st: Styles }) {
  const heading = <Text style={st.heading}>{section.title.toUpperCase()}</Text>;
  switch (section.key) {
    case 'summary':
      return (
        <View style={st.section} wrap={false}>
          {heading}
          <Text>{section.text}</Text>
        </View>
      );
    case 'skills':
      return (
        <View style={st.section}>
          {section.groups.map((g, i) => (
            <View key={g.id} wrap={false}>
              {i === 0 ? heading : null}
              <Text>
                {g.name ? <Text style={st.bold}>{`${g.name}: `}</Text> : null}
                {g.items.join(', ')}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'experience':
      return (
        <View style={st.section}>
          {section.entries.map((e, i) => {
            const line2 = joinFilled([e.location, e.dates], ' | ');
            return (
              <Entry
                key={e.id}
                st={st}
                first={i === 0}
                heading={i === 0 ? heading : undefined}
                bullets={e.bullets}
                header={
                  <>
                    {e.title || e.company ? <Text style={st.bold}>{joinFilled([e.title, e.company], ', ')}</Text> : null}
                    {line2 ? <Text>{line2}</Text> : null}
                  </>
                }
              />
            );
          })}
        </View>
      );
    case 'projects':
      return (
        <View style={st.section}>
          {section.entries.map((p, i) => (
            <Entry
              key={p.id}
              st={st}
              first={i === 0}
              heading={i === 0 ? heading : undefined}
              bullets={p.bullets}
              header={
                <Segments
                  st={st}
                  parts={[{ text: p.name, bold: true }, { text: p.stack }, ...(p.link ? [{ text: p.link.text, href: p.link.href }] : [])]}
                />
              }
            />
          ))}
        </View>
      );
    case 'education':
      return (
        <View style={st.section}>
          {section.entries.map((e, i) => {
            const line2 = joinFilled([e.location, e.dates], ' | ');
            return (
              <View key={e.id} style={i === 0 ? st.firstEntry : st.entry} wrap={false}>
                {i === 0 ? heading : null}
                <Text style={st.bold}>{joinFilled([e.degree, e.institution], ', ')}</Text>
                {line2 ? <Text>{line2}</Text> : null}
                {e.details ? <Text>{e.details}</Text> : null}
              </View>
            );
          })}
        </View>
      );
    case 'certifications':
      return (
        <View style={st.section}>
          {section.entries.map((c, i) => (
            <View key={c.id} wrap={false}>
              {i === 0 ? heading : null}
              <View style={st.bulletRow}>
                <Text style={st.bulletMark}>•</Text>
                <View style={st.bulletText}>
                  <Segments
                    st={st}
                    parts={[
                      { text: c.name, bold: true },
                      { text: c.issuer },
                      { text: c.date },
                      ...(c.link ? [{ text: c.link.text, href: c.link.href }] : []),
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    case 'achievements':
      return (
        <View style={st.section}>
          {section.items.map((t, i) =>
            i === 0 ? (
              <View key={i} wrap={false}>
                {heading}
                <Bullet text={t} st={st} />
              </View>
            ) : (
              <Bullet key={i} text={t} st={st} />
            ),
          )}
        </View>
      );
    case 'languages':
      return (
        <View style={st.section} wrap={false}>
          {heading}
          <Text>{section.items.join(', ')}</Text>
        </View>
      );
  }
}

export function ResumeDocument({ resume, layout }: { resume: ResolvedResume; layout: Layout }) {
  const st = makeStyles(metricsFor(layout));
  return (
    <Document
      title={resume.meta.title}
      author={resume.meta.author}
      subject={resume.meta.subject}
      keywords={resume.meta.keywords}
      creator="Shortlist - ATS Resume Studio"
      producer="Shortlist"
      language="en"
    >
      <Page size={layout.pageSize} style={st.page}>
        <View wrap={false}>
          {resume.name ? <Text style={st.name}>{resume.name}</Text> : null}
          {resume.headline ? <Text style={st.headline}>{resume.headline}</Text> : null}
          {resume.contact.length ? <Contact items={resume.contact} st={st} /> : null}
        </View>
        {resume.sections.map((section) => (
          <SectionView key={section.key} section={section} st={st} />
        ))}
      </Page>
    </Document>
  );
}
