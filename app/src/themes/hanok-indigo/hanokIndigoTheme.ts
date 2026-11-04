/**
 * Street Fitting design system — "Hanok + Indigo" (한옥 + 쪽빛).
 *
 * Source palette: "04 한옥 Hanok · Yeobaek" (sampled), plus an added 쪽빛
 * indigo accent. Light mode only. Flat and matte: no gloss, glass, blur or
 * gradient fills; elevation is a 1px outline.
 *
 *   Giwa 기와 #4A4D50 · Timber 소나무 #7E5F42 · Earth 마당흙 #CDB999
 *   Stone 기단 #B5A68D · Sky 하늘 #DDE3E3 · Hanji 한지 #F1EBDF
 *   Bead #E9DCC2 · Indigo 쪽 #34507A · Ink 먹 #2B2C2E
 *
 * Local tokens (use via var()):
 *   --color-hero, --color-on-hero   header band and its text (8.2:1)
 *   --pattern-eave                  timber strip with bead dots (eave motif)
 *   --color-ink                     near-black for primary buttons, selected chips
 *   --color-hanok-*                 the named source colours, for tiles/illustration
 *
 * Contrast (WCAG, measured): text on page 11.8:1, secondary text 5.7:1,
 * indigo on card 7.6:1, white on indigo 8.2:1.
 *
 * Build: npx astryx theme build src/themes/hanok-indigo/hanokIndigoTheme.ts
 * Font: Outfit, bundled locally by @fontsource-variable/outfit (see main.tsx).
 */
import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral/built';

const HANOK = {
  giwa: '#4A4D50',
  timber: '#7E5F42',
  earth: '#CDB999',
  stone: '#B5A68D',
  sky: '#DDE3E3',
  hanji: '#F1EBDF',
  bead: '#E9DCC2',
  indigo: '#34507A',
};

const SURFACE = '#FAF6EF';
const MUTED = '#E8DECF';
const BORDER = '#DDD0BC';
const INK = '#2B2C2E';
const TEXT_SECONDARY = '#625A50';
const INDIGO_MUTED = '#DCE3EE';

const OUTFIT = {
  family: 'Outfit Variable',
  fallbacks: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
};

export const hanokIndigoTheme = defineTheme({
  name: 'hanok-indigo',
  extends: neutralTheme,

  typography: {
    scale: {base: 16, ratio: 1.2},
    body: OUTFIT,
    heading: {...OUTFIT, weight: 'semibold'},
    code: {family: 'ui-monospace', fallbacks: '"SF Mono", Menlo, Consolas, monospace'},
  },

  tokens: {
    '--color-accent': HANOK.indigo,
    '--color-accent-muted': INDIGO_MUTED,
    '--color-on-accent': '#FFFFFF',
    '--color-text-accent': HANOK.indigo,
    '--color-icon-accent': HANOK.indigo,

    '--color-background-body': HANOK.hanji,
    '--color-background-surface': SURFACE,
    '--color-background-card': SURFACE,
    '--color-background-popover': SURFACE,
    '--color-background-muted': MUTED,
    '--color-background-inverted': INK,

    '--color-text-primary': INK,
    '--color-text-secondary': TEXT_SECONDARY,
    '--color-icon-primary': INK,
    '--color-icon-secondary': TEXT_SECONDARY,

    '--color-border': BORDER,
    '--color-border-emphasized': BORDER,
    '--color-skeleton': MUTED,
    '--focus-outline-color': HANOK.indigo,

    '--radius-inner': '0.375rem',
    '--radius-element': '0.625rem',
    '--radius-container': '0.875rem',
    '--radius-page': '1.5rem',

    // Matte: outlines instead of soft drop shadows.
    '--shadow-low': `0 0 0 1px ${BORDER}`,
    '--shadow-med': `0 0 0 1px ${BORDER}`,
  },

  localTokens: {
    '--color-hero': HANOK.indigo,
    '--color-on-hero': '#FFFFFF',
    '--color-ink': INK,
    '--pattern-eave': `radial-gradient(circle, ${HANOK.bead} 0 3px, transparent 3.5px) 12px 50% / 24px 100% repeat-x, ${HANOK.timber}`,
    '--color-hanok-giwa': HANOK.giwa,
    '--color-hanok-timber': HANOK.timber,
    '--color-hanok-earth': HANOK.earth,
    '--color-hanok-stone': HANOK.stone,
    '--color-hanok-sky': HANOK.sky,
    '--color-hanok-hanji': HANOK.hanji,
    '--color-hanok-bead': HANOK.bead,
    '--color-hanok-indigo': HANOK.indigo,
  },

  components: {
    button: {
      base: {borderRadius: 'var(--radius-full)', fontWeight: 'var(--font-weight-semibold)'},
      'variant:primary': {backgroundColor: 'var(--color-ink)', color: '#FFFFFF'},
      'variant:secondary': {
        backgroundColor: 'var(--color-background-surface)',
        boxShadow: `inset 0 0 0 1px ${BORDER}`,
      },
    },
    card: {base: {borderRadius: 'var(--radius-container)'}},
    badge: {base: {borderRadius: 'var(--radius-full)'}},
  },
});
