// Theme ids (spec 3.2): the English name in lower case, spaces and symbols turned into "-".
// Stage 10A draws every screen with the default theme, Mono; the other 19 come in stage 10D.

import { ITEMS } from './strings.js';

export const THEME_IDS = ITEMS.themes.map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

export const DEFAULT_THEME = 'mono';

// Codes of the themes before data v5 (app 0.7.0) -> new theme ids (spec 3.2 table).
export const OLD_THEME_MAP = Object.freeze({
  pureBlack: 'mono',
  terminal: 'terminal',
  amberScreen: 'receipt', // Typewriter
  notebook: 'polaroid',
  washi: 'stamp', // Ink
  newspaper: 'tear-off',
  blueprint: 'label',
  nightSky: 'dial', // Midnight
  forest: 'emblem', // Stone
  neon: 'scoreboard', // Arcade
  daylight: 'folder',
  highContrast: 'poster',
  system: 'system',
});

/** New id for an old theme code (unknown codes map to themselves when they are already new ids). */
export function mapOldTheme(code) {
  if (OLD_THEME_MAP[code]) return OLD_THEME_MAP[code];
  return THEME_IDS.includes(code) ? code : null;
}
