import type { CSSProperties } from 'react';

/** Soft backdrops for project cards: [light ground, ink, dark-mode ink]. Dark mode mixes its ground from the ink (see site.css). */
const PALETTES: Array<[string, string, string]> = [
  ['#e9edff', '#3d4ef5', '#7b88ff'],
  ['#fff0e6', '#ff6a2c', '#ff7d45'],
  ['#e6f6ec', '#14995a', '#3fc283'],
  ['#f1ebff', '#7448ff', '#9a7bff'],
  ['#fff6d4', '#d99a00', '#f0b72e'],
  ['#ffe8ee', '#f0386b', '#ff5c88'],
  ['#e3f5fa', '#0b9cc0', '#2fbfe3'],
  ['#ececeb', '#161616', '#d8d8d4'],
];

const hash = (text: string) => [...text].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 2654435761) >>> 0, 2166136261);

/** CSS variables for the palette chosen by `key`; `.tone` elements resolve them per theme. */
export function paletteStyle(key: string) {
  const [bg, ink, glow] = PALETTES[hash(key) % PALETTES.length];
  return { '--tone-bg': bg, '--tone-ink': ink, '--tone-glow': glow } as CSSProperties;
}
