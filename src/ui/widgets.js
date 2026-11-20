// Shared UI pieces: bottom sheet, long press, swipe, segmented choice, 24 h time picker.

import { el, svg } from '../dom.js';
import { raw } from '../text.js';

// ---- Bottom sheet ----

let openSheetClose = null;

/** Show nodes in a bottom sheet. Returns a close() function. */
export function openSheet(...nodes) {
  if (openSheetClose) openSheetClose();
  const panel = el('div', { class: 'sheet-panel fade-in' }, ...nodes);
  const backdrop = el('div', { class: 'sheet-backdrop fade-in' }, panel);
  const close = () => {
    backdrop.remove();
    if (openSheetClose === close) openSheetClose = null;
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.body.append(backdrop);
  openSheetClose = close;
  return close;
}

export function closeSheet() {
  if (openSheetClose) openSheetClose();
}

// ---- Long press (no text selection or system menu, see theme.css) ----

export function onLongPress(node, onLong, onTap) {
  let timer = null;
  let fired = false;
  let x0 = 0;
  let y0 = 0;
  const cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  node.addEventListener('touchstart', (e) => {
    fired = false;
    const t = e.touches[0];
    x0 = t.clientX;
    y0 = t.clientY;
    timer = setTimeout(() => {
      fired = true;
      timer = null;
      if (navigator.vibrate) navigator.vibrate(10);
      onLong(e);
    }, 500);
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - x0) > 10 || Math.abs(t.clientY - y0) > 10) cancel();
  }, { passive: true });
  node.addEventListener('touchend', cancel);
  node.addEventListener('touchcancel', cancel);
  node.addEventListener('contextmenu', (e) => {
    // Desktop preview: right click acts as long press.
    e.preventDefault();
    if (!('ontouchstart' in window)) onLong(e);
  });
  node.addEventListener('click', (e) => {
    if (fired) {
      e.preventDefault();
      e.stopPropagation();
      fired = false;
      return;
    }
    if (onTap) onTap(e);
  });
}

// ---- Horizontal swipe ----

export function onSwipe(node, { left, right }) {
  let x0 = null;
  let y0 = null;
  node.addEventListener('touchstart', (e) => {
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });
  node.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && left) left();
    if (dx > 0 && right) right();
  });
}

// ---- Segmented choice ----

/**
 * options: [{ value, label, disabled?, note? }]
 * Returns { node, get value() }.
 */
export function segmented(options, value, onChange, { multi = false } = {}) {
  let current = multi ? new Set(value || []) : value;
  const buttons = options.map((opt) => {
    const b = el('button', { type: 'button', class: 'seg-btn', disabled: opt.disabled || undefined }, opt.label);
    b.addEventListener('click', () => {
      if (opt.disabled) return;
      if (multi) {
        if (current.has(opt.value)) current.delete(opt.value);
        else current.add(opt.value);
      } else {
        current = opt.value;
      }
      paint();
      if (onChange) onChange(multi ? [...current] : current);
    });
    return b;
  });
  const node = el('div', { class: 'seg' }, buttons);
  function paint() {
    options.forEach((opt, i) => {
      const on = multi ? current.has(opt.value) : current === opt.value;
      buttons[i].classList.toggle('on', on);
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  paint();
  return {
    node,
    get value() {
      return multi ? [...current] : current;
    },
    set value(v) {
      current = multi ? new Set(v) : v;
      paint();
    },
  };
}

// ---- 24 h time picker (two native wheels; never follows the 12 h system setting) ----

export function timePicker(value = '21:00', onChange) {
  const [h0, m0] = value.split(':').map(Number);
  const hours = el('select', { class: 'num' },
    Array.from({ length: 24 }, (_, h) => el('option', { value: h, selected: h === h0 || undefined }, String(h).padStart(2, '0'))));
  const mins = el('select', { class: 'num' },
    Array.from({ length: 12 }, (_, i) => {
      const m = i * 5;
      return el('option', { value: m, selected: m === Math.floor(m0 / 5) * 5 || undefined }, String(m).padStart(2, '0'));
    }));
  const get = () => `${String(hours.value).padStart(2, '0')}:${String(mins.value).padStart(2, '0')}`;
  hours.addEventListener('change', () => onChange && onChange(get()));
  mins.addEventListener('change', () => onChange && onChange(get()));
  const node = el('div', { class: 'time-picker' }, hours, el('span', { class: 'num' }, ':'), mins);
  return { node, get value() { return get(); } };
}

// ---- Misc ----

export function field(label, ...controls) {
  // A div, not a <label>: a label would forward taps on its text to the first button inside.
  return el('div', { class: 'field' }, el('span', { class: 'field-label' }, label), ...controls);
}

export function textInput(value = '', attrs = {}) {
  return el('input', { type: 'text', value, autocomplete: 'off', autocapitalize: 'sentences', ...attrs });
}

export function numberInput(value = '', attrs = {}) {
  return el('input', { type: 'text', inputmode: 'decimal', pattern: '[0-9]*', value: value === null ? '' : value, class: 'num', ...attrs });
}

const BACK_ICON = '<path d="M15 5l-7 7 7 7"/>';

export function backButton(onClick) {
  return el('button', { type: 'button', class: 'icon-btn', 'aria-label': raw('L72'), onclick: onClick }, svg(BACK_ICON));
}

export function bar(progress) {
  const fill = el('span', { class: 'bar-fill' });
  fill.style.width = `${Math.round(progress * 100)}%`;
  return el('span', { class: 'bar' }, fill);
}
