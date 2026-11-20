// Home screen skeleton (stage 1): focus area + Settings / About your data.
// Cards, talents and the other sections arrive in later stages.

import { el } from '../dom.js';
import { text, raw } from '../text.js';
import { APP_VERSION } from '../version.js';
import { CONFIG } from '../config.js';

/** Total level from total EXP (spec 6.11). */
export function levelFromExp(totalExp) {
  const { base, growth } = CONFIG.levelCurve;
  let lv = 1;
  let left = totalExp;
  for (;;) {
    const need = Math.round(base * growth ** (lv - 1));
    if (left < need) return lv;
    left -= need;
    lv += 1;
  }
}

export function renderHome({ player }) {
  const sections = raw('L60');
  const settingsItems = raw('L69');

  const focus = el('section', { class: 'focus fade-in' },
    el('div', { class: 'top-row' },
      el('span', { class: 'num' }, text('S50', { lv: levelFromExp(player.totalExp) })),
      el('span', { class: 'num' }, text('S51', { done: 0, planned: 0 })),
    ),
    el('div', { class: 'card frame' },
      el('p', { class: 'line1' }, text('S47')),
    ),
  );

  const settings = el('section', { class: 'section' },
    el('h2', { class: 'section-title' }, sections[6]),
    el('div', { class: 'row' },
      el('h3', {}, settingsItems[5]),
      el('p', {}, text('S54')),
      el('p', { class: 'muted small num' }, text('S64', { version: APP_VERSION })),
    ),
  );

  return [focus, settings];
}
