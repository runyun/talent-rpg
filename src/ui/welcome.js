// First use, step 2 (spec 5.7): S47, tap anywhere to continue.

import { el } from '../dom.js';
import { text } from '../text.js';

export function renderWelcome({ onContinue }) {
  const node = el('section', { class: 'install fade-in' },
    el('div', { class: 'card frame' }, el('p', { class: 'line1' }, text('S47'))));
  node.addEventListener('click', onContinue, { once: true });
  return node;
}
