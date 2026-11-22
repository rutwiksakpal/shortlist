import './fonts';
import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { Fragment } from 'react';
import type { ResolvedCoverLetter } from '../coverLetter';
import type { Layout } from '../schema';
import { metricsFor } from './layout';
import { TEMPLATES } from './templates';

/** One-page cover letter in the same ATS-safe style as the resume. */
export function CoverLetterDocument({ letter, layout }: { letter: ResolvedCoverLetter; layout: Layout }) {
  const t = TEMPLATES[layout.template] ?? TEMPLATES.simple;
  const m = metricsFor(layout);
  const st = StyleSheet.create({
    page: {
      padding: m.pagePadding,
      fontFamily: t.regular,
      fontSize: m.body + 0.5,
      lineHeight: 1.45,
      color: '#000000',
      backgroundColor: '#FFFFFF',
    },
    name: { fontFamily: t.bold, fontSize: t.nameSize, lineHeight: 1.15, textAlign: t.headerAlign },
    headline: { fontSize: m.headline, marginTop: 2, textAlign: t.headerAlign },
    contact: { marginTop: 3, textAlign: t.headerAlign, fontSize: m.body },
    block: { marginTop: 18 },
    para: { marginTop: 10 },
    link: { color: '#000000', textDecoration: 'none' },
  });
  return (
    <Document
      title={letter.meta.title}
      author={letter.meta.author}
      creator="Shortlist - ATS Resume Studio"
      producer="Shortlist"
      language="en"
    >
      <Page size={layout.pageSize} style={st.page}>
        <View>
          {letter.name ? <Text style={st.name}>{letter.name}</Text> : null}
          {letter.headline ? <Text style={st.headline}>{letter.headline}</Text> : null}
          {letter.contact.length ? (
            <Text style={st.contact}>
              {letter.contact.map((c, i) => (
                <Fragment key={i}>
                  {i > 0 ? ' | ' : ''}
                  {c.href ? (
                    <Link src={c.href} style={st.link}>
                      {c.text}
                    </Link>
                  ) : (
                    c.text
                  )}
                </Fragment>
              ))}
            </Text>
          ) : null}
        </View>
        {letter.date ? <Text style={st.block}>{letter.date}</Text> : null}
        {letter.recipient.length ? (
          <View style={letter.date ? st.para : st.block}>
            {letter.recipient.map((r, i) => (
              <Text key={i}>{r}</Text>
            ))}
          </View>
        ) : null}
        <Text style={st.block}>{letter.greeting}</Text>
        {letter.paragraphs.map((p, i) => (
          <Text key={i} style={st.para}>
            {p}
          </Text>
        ))}
        <View style={st.block} wrap={false}>
          <Text>{letter.closing}</Text>
          {letter.signature ? <Text style={{ marginTop: 14 }}>{letter.signature}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}
