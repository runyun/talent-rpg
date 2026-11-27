// Text lookup and filling. English only; this is not a multi-language layer.
// Rules (spec section 8):
// - Fill {variable} placeholders.
// - If a variable has no value, remove its whole unit: the (...) group it is in,
//   otherwise the " | " or " · " segment it is in, otherwise just the placeholder.
//   Never show blanks or "undefined".
// - Count 1 uses the singular of the following plural noun; any other count uses the plural.

import {
  S, E, C, L, G, H, ITEMS,
} from './strings.js';

const TABLES = [S, E, L];

// System tags like [TRIAL] (spec 3): each theme shows them with its own symbols.
// In the copy they are always written [TAG]. text() marks them with two private-use
// characters; dom.js turns a marked tag into <span class="sys-tag">TAG</span>, and the
// theme's CSS adds the symbols. plain() gives the [TAG] form for non-DOM uses (share text).
export const TAG_OPEN = '\uE000';
export const TAG_CLOSE = '\uE001';
const TAG_RE = /\[([A-Z][A-Z ]*[A-Z])\]/g;

function markTags(template) {
  return template.replace(TAG_RE, (m, name) => `${TAG_OPEN}${name}${TAG_CLOSE}`);
}

/** Text with marked tags back to the copy form ("[TRIAL] ..."). */
export function plain(s) {
  return String(s).replace(/\uE000([^\uE001]*)\uE001/g, '[$1]');
}

// Plural nouns that appear right after a count in the copy sheet.
const SINGULAR = {
  tickets: 'ticket',
  slots: 'slot',
  days: 'day',
  draws: 'draw',
  sessions: 'session',
  prizes: 'prize',
  jackpots: 'jackpot',
  differences: 'difference',
  weeks: 'week',
  steps: 'step',
  practices: 'practice',
  passes: 'pass',
  companions: 'companion',
};

function isMissing(value) {
  return value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value));
}

/** Raw entry for a code (string or array). Throws for unknown codes so gaps show up in development. */
export function raw(key) {
  for (const table of TABLES) {
    if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  }
  throw new Error(`Unknown text key: ${key}`);
}

/** Fill a template string with values. */
export function fill(template, vars = {}) {
  let out = template;

  // 1. Remove units that contain a missing variable.
  const names = [...out.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  for (const name of new Set(names)) {
    if (!isMissing(vars[name])) continue;
    out = removeUnit(out, `{${name}}`);
  }

  // 2. Singular after a count of 1 (look at most 2 words ahead, skip placeholders).
  const tokens = out.split(/(\s+)/); // words at even indexes, spaces at odd indexes
  for (let i = 0; i < tokens.length; i += 2) {
    const m = tokens[i].match(/\{(\w+)\}/);
    if (!m) continue;
    const value = vars[m[1]];
    if (typeof value === 'boolean' || Number(value) !== 1) continue;
    for (let j = i + 2; j <= i + 4 && j < tokens.length; j += 2) {
      if (tokens[j].includes('{')) break;
      const word = tokens[j].replace(/[.,:;!?]+$/, '');
      if (SINGULAR[word]) {
        tokens[j] = SINGULAR[word] + tokens[j].slice(word.length);
        break;
      }
    }
  }
  out = tokens.join('');

  // 3. Substitute.
  out = out.replace(/\{(\w+)\}/g, (m, name) => String(vars[name]));
  return out;
}

function removeUnit(str, placeholder) {
  let s = str;
  while (s.includes(placeholder)) {
    const at = s.indexOf(placeholder);

    // Inside a (...) group: remove the group and the space before it.
    const open = s.lastIndexOf('(', at);
    const close = s.indexOf(')', at);
    if (open !== -1 && close !== -1 && s.lastIndexOf(')', at) < open) {
      s = (s.slice(0, open).replace(/\s+$/, '') + s.slice(close + 1)).trim();
      continue;
    }

    // Inside a " | " or " · " segment.
    const sepRe = / [|·] /g;
    const seps = [...s.matchAll(sepRe)].map((m) => m.index);
    if (seps.length > 0) {
      const before = seps.filter((i) => i < at).pop();
      const after = seps.find((i) => i > at);
      const start = before === undefined ? 0 : before;
      const end = after === undefined ? s.length : after;
      if (before === undefined) {
        // First segment: remove it and the separator after it.
        s = s.slice(end + 3);
      } else {
        s = s.slice(0, start) + s.slice(end);
      }
      continue;
    }

    // Plain placeholder: remove it and collapse spaces.
    s = s.replace(placeholder, '').replace(/ {2,}/g, ' ').replace(/ ([.,:])/g, '$1').trim();
  }
  return s;
}

/** Look up a code and fill it. For array entries, pass an index: text('L81', {}, 2). */
export function text(key, vars = {}, index) {
  let entry = raw(key);
  if (Array.isArray(entry)) {
    if (index === undefined) throw new Error(`Text key ${key} is a list; pass an index`);
    entry = entry[index];
  }
  return fill(markTags(entry), vars);
}

/** The tag of a copy entry without its symbols, e.g. tagOf('S01') -> 'TRAINING'. */
export function tagOf(key) {
  const m = String(raw(key)).match(/\[([A-Z][A-Z ]*[A-Z])\]/);
  return m ? m[1] : '';
}

/** Guide entry (G series): { group, title, text, unlock }. */
export function guide(key) {
  return G[key];
}

export const GUIDE_KEYS = Object.keys(G);

/** How it works step (H series): { title, text, example }. */
export function how(key) {
  return H[key];
}

export const HOW_KEYS = Object.keys(H);

/** Congratulation line by tone: 'gentle' | 'brief' | 'firedUp'. */
export function congrats(key, tone, vars = {}) {
  return fill(C[key][tone], vars);
}

export { ITEMS };
