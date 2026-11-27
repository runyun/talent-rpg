// Shared UI pieces: bottom sheet, long press, swipe rows, segmented choice, switch,
// 24 h time picker, grouped lists, rank ladder, week cells, short notes.

import { el, svg } from '../dom.js';
import { raw } from '../text.js';
import { CONFIG } from '../config.js';

const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Bottom sheet (spec 2 "bottom sheet", 3.1, 3.3) ----
// Rises from the bottom over a dimmed page; the page behind is locked (no scroll, no taps:
// a tap on it closes the sheet). Dragging the handle or the sheet down also closes it.

let openSheetClose = null;
let lockedScrollY = 0;

function lockPage() {
  lockedScrollY = window.scrollY;
  document.body.classList.add('sheet-open');
  document.body.style.top = `-${lockedScrollY}px`;
}

function unlockPage() {
  document.body.classList.remove('sheet-open');
  document.body.style.top = '';
  window.scrollTo(0, lockedScrollY);
}

/** Show nodes in a bottom sheet. Returns a close() function. onClose runs after it closes. */
export function openSheet(nodes, { onClose = null } = {}) {
  if (openSheetClose) openSheetClose({ instant: true });
  const handle = el('div', { class: 'sheet-handle', 'aria-hidden': 'true' });
  const body = el('div', { class: 'sheet-body' }, ...[].concat(nodes));
  const panel = el('div', { class: 'sheet-panel', role: 'dialog', 'aria-modal': 'true' }, handle, body);
  const backdrop = el('div', { class: 'sheet-backdrop' }, panel);
  let closed = false;
  const close = ({ instant = false } = {}) => {
    if (closed) return;
    closed = true;
    if (openSheetClose === close) openSheetClose = null;
    const done = () => {
      backdrop.remove();
      if (!openSheetClose) unlockPage();
      if (onClose) onClose();
    };
    if (instant || reduceMotion()) {
      done();
      return;
    }
    backdrop.classList.add('closing');
    setTimeout(done, 250);
  };
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Drag down to close (from anywhere on the sheet while its content is scrolled to the top).
  let y0 = null;
  let dy = 0;
  panel.addEventListener('touchstart', (e) => {
    if (body.scrollTop > 0 && !handle.contains(e.target)) return;
    y0 = e.touches[0].clientY;
    dy = 0;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) panel.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  panel.addEventListener('touchend', () => {
    if (y0 === null) return;
    y0 = null;
    panel.style.transform = '';
    if (dy > 80) close();
  });
  // The page behind never scrolls while the sheet is open.
  backdrop.addEventListener('touchmove', (e) => {
    if (!panel.contains(e.target)) e.preventDefault();
  }, { passive: false });

  if (!openSheetClose) lockPage();
  document.body.append(backdrop);
  openSheetClose = close;
  return close;
}

export function closeSheet(opts) {
  if (openSheetClose) openSheetClose(opts);
}

export function sheetIsOpen() {
  return openSheetClose !== null;
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

// ---- Swipe left on a list row to show actions (spec 5.8.2) ----

/** Wrap a row so a left swipe reveals action buttons. actions: [{ label, onClick }]. */
export function swipeRow(content, actions) {
  const buttons = el('div', { class: 'swipe-actions' }, actions.map((a) => el('button', {
    type: 'button', class: 'swipe-action', onclick: a.onClick,
  }, a.label)));
  const front = el('div', { class: 'swipe-front' }, content);
  const row = el('div', { class: 'swipe-row' }, buttons, front);
  let x0 = null;
  let y0 = null;
  let open = false;
  const width = () => buttons.offsetWidth || 160;
  const set = (x) => { front.style.transform = x ? `translateX(${x}px)` : ''; };
  front.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t.clientX < 24) return; // leave the screen edge to the system back gesture
    x0 = t.clientX;
    y0 = t.clientY;
  }, { passive: true });
  front.addEventListener('touchmove', (e) => {
    if (x0 === null) return;
    const t = e.touches[0];
    const dx = t.clientX - x0 + (open ? -width() : 0);
    if (Math.abs(t.clientY - y0) > Math.abs(t.clientX - x0)) return;
    set(Math.min(0, Math.max(-width(), dx)));
  }, { passive: true });
  front.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (!open && dx < -40) open = true;
    else if (open && dx > 40) open = false;
    set(open ? -width() : 0);
  });
  return { node: row, close: () => { open = false; set(0); } };
}

// ---- Segmented choice ----

/**
 * options: [{ value, label, disabled? }]. onDisabled(opt) runs when a disabled option is tapped.
 * Returns { node, value }.
 */
export function segmented(options, value, onChange, { multi = false, onDisabled = null } = {}) {
  let current = multi ? new Set(value || []) : value;
  const buttons = options.map((opt) => {
    const b = el('button', { type: 'button', class: `seg-btn${opt.disabled ? ' off' : ''}`, 'aria-disabled': opt.disabled ? 'true' : undefined }, opt.label);
    b.addEventListener('click', () => {
      if (opt.disabled) {
        if (onDisabled) onDisabled(opt);
        return;
      }
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

// ---- System-style switch ----

export function toggle(on, onChange, label) {
  const input = el('input', {
    type: 'checkbox', class: 'switch', role: 'switch', checked: on || undefined, 'aria-label': label,
  });
  input.addEventListener('change', () => onChange(input.checked));
  return input;
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

// ---- Inputs ----

export function field(label, ...controls) {
  // A div, not a <label>: a label would forward taps on its text to the first button inside.
  return el('div', { class: 'field' }, el('span', { class: 'field-label' }, label), ...controls);
}

export function textInput(value = '', attrs = {}) {
  return el('input', {
    type: 'text', value: value === null || value === undefined ? '' : value, autocomplete: 'off', autocapitalize: 'sentences', ...attrs,
  });
}

export function numberInput(value = '', attrs = {}) {
  return el('input', {
    type: 'text', inputmode: 'decimal', value: value === null || value === undefined ? '' : value, class: 'num', autocomplete: 'off', ...attrs,
  });
}

// ---- Buttons and page tops ----

const BACK_ICON = '<path d="M15 5l-7 7 7 7"/>';

export function backButton(onClick) {
  return el('button', { type: 'button', class: 'icon-btn', 'aria-label': raw('L72'), onclick: onClick }, svg(BACK_ICON));
}

/** "Delete" that turns into "Tap again to delete" (L16 / L17). */
export function confirmDeleteButton(onConfirm, cls = 'btn') {
  let armed = false;
  const b = el('button', { type: 'button', class: cls }, raw('L16'));
  b.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      b.textContent = raw('L17');
      return;
    }
    b.disabled = true;
    onConfirm();
  });
  return b;
}

// ---- Grouped lists (spec 3.1) ----

/** A group: small title above a rounded card with one row per item. */
export function group(title, rows, { note = null, cls = '' } = {}) {
  const items = rows.filter(Boolean);
  return el('section', { class: `group ${cls}` },
    title ? el('h2', { class: 'group-title' }, title) : null,
    items.length ? el('div', { class: 'group-card' }, items) : null,
    note ? el('p', { class: 'group-note muted small' }, note) : null);
}

/** A tappable row: left label, right value (gray) and a chevron. */
export function navRow(label, value, onClick, { sub = null } = {}) {
  return el('button', { type: 'button', class: 'row row-tap', onclick: onClick },
    el('span', { class: 'row-main' }, el('span', { class: 'row-label' }, label), sub ? el('span', { class: 'row-sub muted small' }, sub) : null),
    value !== null && value !== undefined && value !== '' ? el('span', { class: 'row-value muted' }, value) : null,
    el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›'));
}

/** A plain row (not tappable). */
export function infoRow(label, value = null) {
  return el('div', { class: 'row' },
    el('span', { class: 'row-main' }, el('span', { class: 'row-label' }, label)),
    value !== null && value !== undefined ? el('span', { class: 'row-value muted' }, value) : null);
}

// ---- Same things look the same (spec 3.1) ----

/** E -> S ladder: 6 dots, reached ones filled, the current rank with a thick ring. */
export function rankLadder(rank) {
  const ranks = CONFIG.ranks;
  const at = ranks.indexOf(rank);
  return el('span', { class: 'ladder', role: 'img', 'aria-label': ranks.slice(0, at + 1).join(' ') },
    ranks.map((r, i) => el('span', { class: `ladder-step${i <= at ? ' on' : ''}${i === at ? ' now' : ''}` },
      el('span', { class: 'ladder-dot' }),
      el('span', { class: 'ladder-letter small' }, r))));
}

/** Role tag: Main solid, Maintain gray frame. */
export function roleTag(role) {
  if (role === 'main') return el('span', { class: 'tag tag-solid' }, raw('L45'));
  if (role === 'maintain') return el('span', { class: 'tag tag-frame' }, raw('L46'));
  return el('span', { class: 'tag tag-frame' }, raw('L47'));
}

// ---- Short note under Today (S09, Saved · Undo) ----

let noteNode = null;
let noteTimer = null;

/** Show a short note above the bottom buttons for ms. content: text or a node. */
export function showNote(content, ms = CONFIG.noteMs) {
  hideNote();
  noteNode = el('div', { class: 'note', role: 'status' }, content);
  // On Today the note rises right above the bottom buttons, never over them.
  const buttons = document.querySelector('.today-bottom');
  if (buttons) noteNode.style.bottom = `${Math.max(0, window.innerHeight - buttons.getBoundingClientRect().top + 8)}px`;
  document.body.append(noteNode);
  noteTimer = setTimeout(hideNote, ms);
  return hideNote;
}

export function hideNote() {
  clearTimeout(noteTimer);
  noteTimer = null;
  if (noteNode) {
    const n = noteNode;
    noteNode = null;
    n.classList.add('closing');
    setTimeout(() => n.remove(), reduceMotion() ? 0 : 200);
  }
}

/** Copy text with the browser clipboard (spec 2); falls back to a hidden text box. */
export async function copyText(s) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    const area = el('textarea', { readonly: true, class: 'offscreen' });
    area.value = s;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** The example box (L86): two gray lines, one per talent (spec 5.6). */
export function exampleBox(key, textOf) {
  const s = textOf(key);
  // Items are separated by " · "; S126 uses " · " inside each item, so it splits at ", " instead.
  let parts = s.split(' · ');
  if (parts.length !== 2) parts = s.split(', ');
  return el('div', { class: 'example' },
    el('span', { class: 'example-title small' }, raw('L86')),
    ...parts.map((p) => el('span', { class: 'muted small' }, p)));
}
