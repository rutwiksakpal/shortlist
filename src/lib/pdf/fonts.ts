import { Font } from '@react-pdf/renderer';

/**
 * Never hyphenate. Automatic hyphenation splits words and URLs ("github.com/alexmor-gan")
 * across lines, which breaks keyword matching and links when an ATS extracts the text.
 */
Font.registerHyphenationCallback((word) => [word]);
