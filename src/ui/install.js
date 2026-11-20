// "Add to Home Screen" guide, shown when the app is opened in a Safari tab (spec 5.7 step 1).

import { el, svg } from '../dom.js';
import { text } from '../text.js';

const SHARE_ICON = '<rect x="5" y="9" width="14" height="12" rx="2"/><path d="M12 3v12M8 7l4-4 4 4"/>';
const ADD_ICON = '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>';
const ARROW_ICON = '<path d="M5 12h14M14 7l5 5-5 5"/>';

export function isStandalone() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches;
}

export function renderInstall({ onContinue }) {
  return el('section', { class: 'install fade-in' },
    el('div', { class: 'install-steps' },
      el('div', { class: 'install-step' }, svg(SHARE_ICON), el('span', { class: 'num muted small' }, '1')),
      el('div', { class: 'install-arrow' }, svg(ARROW_ICON)),
      el('div', { class: 'install-step' }, svg(ADD_ICON), el('span', { class: 'num muted small' }, '2')),
    ),
    el('p', { class: 'frame' }, text('S48')),
    el('div', { class: 'focus-bottom' },
      el('button', { class: 'btn', type: 'button', onclick: onContinue }, text('L10')),
    ),
  );
}
