// Today (spec 5.1): title row, this week's 7 cells, swipeable task cards, bottom buttons.
// One screen high, never scrolls, nothing about companions, shop, ranking or the vault.

import { el, mount, svg } from '../dom.js';
import { text, raw } from '../text.js';
import {
  addDays, dateKey, dayLabel, fromDateKey, hm, weekKey, weekdayLetter,
} from '../time.js';
import { fmtValue, fmtNumber, parseNumber } from '../format.js';
import { state } from '../store.js';
import { levelFromExp } from '../model/record.js';
import { recordAt, instanceForTalent } from '../model/schedule.js';
import {
  todayCards, stateCard, nextSlot, practicedToday, todaysRecords,
} from '../model/today.js';
import { shownTarget, tooCloseToGoal, dirOf } from '../model/practice.js';
import { STAR, challengeEntry, gateFor } from '../model/challenge.js';
import { fmtStep } from '../format.js';
import { savePlayer } from '../store.js';
import { openSheet, closeSheet } from './widgets.js';
import { sundayCardDue, renderSundayCard, sameSlotsNotice } from './sunday.js';
import { titleNode } from './appearance.js';
import { roleTag } from './widgets.js';
import {
  openReport, openQuick, openMore, otherTalentSheet,
} from './report.js';
import { completePractice } from './finish.js';
import { app } from './app.js';

// What Today remembers between renders: the card on show, a talent picked with Other talent,
// and numbers typed into Find your start cards.
const ui = {
  currentId: null, extraId: null, startInputs: {}, signature: null,
};

export function rankText(talent) {
  if (talent.rank === 'S' && talent.stars) return text('S277', { count: talent.stars });
  return text('L48', { rank: talent.rank });
}

/** Show a talent's card (Other talent, Practice more). Adds a temporary card when it has none. */
export function focusTalent(talentId) {
  ui.extraId = talentId;
  ui.currentId = talentId;
  app.refresh({ force: true });
}

/** Forget the temporary card (after practicing it, or on the next open). */
export function clearExtra(talentId) {
  if (!talentId || ui.extraId === talentId) ui.extraId = null;
}

// ---- Parts ----

function titleRow() {
  const p = state.player;
  return el('header', { class: 'today-top' },
    el('h1', { class: 'big-title' }, deco('system-title', raw('L152')), el('span', { class: 'title-word' }, raw('L81')[0])),
    el('span', { class: 'today-lv muted' },
      titleNode(p),
      el('span', { class: 'num' }, text('S276', { lv: levelFromExp(p.totalExp) }))));
}

/** Monday-Sunday: filled when anything was practiced that day; today has a thick frame. */
export function weekCells(week, now) {
  const wk = weekKey(now);
  const days = new Set(state.sessions.filter((r) => weekKey(new Date(recordAt(r))) === wk).map((r) => dateKey(new Date(recordAt(r)))));
  const today = dateKey(now);
  return el('div', { class: 'week-cells', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const key = dateKey(addDays(fromDateKey(wk), d - 1));
    return el('span', { class: `week-cell${days.has(key) ? ' done' : ''}${key === today ? ' is-today' : ''}` },
      el('span', { class: 'week-box' }),
      el('span', { class: 'week-letter small muted' }, weekdayLetter(d), el('span', { class: 'deco deco-date num' }, String(fromDateKey(key).getDate()))));
  }));
}

export function weekHeader(week) {
  const count = week.planned > 0 ? text('S139', { done: week.done, planned: week.planned }) : String(week.done);
  return el('div', { class: 'week-head' },
    el('span', { class: 'small' }, raw('L95')),
    el('span', { class: 'num small' }, count));
}

function nameRow(talent, now) {
  const done = practicedToday(state, now, talent.id);
  const gate = gateFor(state, weekKey(now)) === talent.id;
  return el('div', { class: 'card-name' },
    el('span', { class: 'card-name-left' },
      el('span', { class: 'talent-name' }, talent.name),
      roleTag(talent.role),
      gate ? el('span', { class: 'tag tag-frame' }, raw('L96')) : null),
    done ? el('span', { class: 'tag tag-solid small' }, raw('L103')) : el('span', { class: 'muted small num' }, rankText(talent)));
}

function needsWorkPart(talent) {
  const list = talent.needsWork || [];
  if (!list.length) return null;
  const oldest = list.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
  return el('div', { class: 'card-part' },
    el('span', { class: 'part-label small muted' }, text('S141', { count: list.length })),
    el('button', { type: 'button', class: 'line-tap', onclick: () => app.needsWork(talent.id) },
      el('span', { class: 'clip' }, oldest.text),
      el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›')));
}

/** A hint box: outline, optional second line, and a chevron when it can be tapped. */
const seenHints = new Set(); // hints already shown in this session: the drop-in plays once

function hintBox(first, second, onTap) {
  const fresh = !seenHints.has(first);
  seenHints.add(first);
  const extra = fresh ? ' hint-new' : '';
  const inner = [el('span', { class: 'hint-lines' }, el('span', {}, first), second ? el('span', { class: 'muted small' }, second) : null)];
  if (onTap) {
    inner.push(el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›'));
    return el('button', { type: 'button', class: `hint hint-tap${extra}`, onclick: onTap }, inner);
  }
  return el('div', { class: `hint${extra}` }, inner);
}

/** Card hint (5.1.1 item 2): challenge > plateau > return; at most one. */
function hintFor(t, now) {
  const entry = challengeEntry(state, t, now);
  if (entry) {
    const out = [];
    if (entry.ready) {
      out.push(hintBox(entry.rank === STAR ? text('S211') : text('S144', { rank: entry.rank }), text('S145'), () => app.challenge(t.id)));
    } else {
      out.push(hintBox(text('S146', { rank: entry.rank === STAR ? 'S' : entry.rank }), null, null));
    }
    const seen = state.player.seenExplanations || [];
    if (!seen.includes('S185')) {
      out.push(el('p', { class: 'muted small' }, text('S185')));
      savePlayer({ ...state.player, seenExplanations: [...seen, 'S185'] });
    }
    return out;
  }
  if (t.plateau && t.plateau.active) {
    return [hintBox(text('S147', { step: fmtStep(t, t.step, dirOf(t)) }), text('S148'), () => plateauSheet(t))];
  }
  if (state.player.returnActive) return [hintBox(text('S149'), text('S150'), null)];
  return [];
}

/** Plateau sheet: change a check, or one Checkpoint (spec 5.1.1, 7.4). */
function plateauSheet(t) {
  openSheet([
    el('div', { class: 'group-card' },
      el('button', { type: 'button', class: 'row row-tap', onclick: () => { closeSheet({ instant: true }); app.talent(t.id, { openChecks: true }); } },
        el('span', { class: 'row-label' }, raw('L126')), el('span', { class: 'chev muted' }, '›')),
      t.plateau.checkpointOffered ? null : el('button', { type: 'button', class: 'row row-tap', onclick: () => { closeSheet({ instant: true }); app.checkpoint(t.id); } },
        el('span', { class: 'row-label' }, raw('L125')), el('span', { class: 'chev muted' }, '›'))),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

/**
 * Theme decorations (spec 3.2): hidden in Mono, shown by themes.css. They only use the card's own
 * information and the theme words L150-L155, so every theme shows the same facts.
 */
function deco(kind, ...children) {
  return el('span', { class: `deco deco-${kind}`, 'aria-hidden': 'true' }, ...children);
}

/** The big number: digits (Scoreboard tiles) and the unit. */
function bigNumber(t, v) {
  const n = fmtNumber(v, t.wholeNumbers);
  if (n === null) return el('span', { class: 'target-big num' });
  return el('span', { class: 'target-big num' },
    el('span', { class: 'target-num' }, [...n].map((ch) => el('span', { class: 'dg' }, ch))),
    t.unit ? el('span', { class: 'target-unit' }, ` ${t.unit}`) : null);
}

/** Dial: this week's 7 days as a ring (done days filled, today thin). */
function weekRing(week) {
  const parts = [];
  for (let i = 0; i < 7; i += 1) {
    const a0 = (i / 7) * 2 * Math.PI - Math.PI / 2 + 0.06;
    const a1 = ((i + 1) / 7) * 2 * Math.PI - Math.PI / 2 - 0.06;
    const p = (a) => `${(50 + 44 * Math.cos(a)).toFixed(2)} ${(50 + 44 * Math.sin(a)).toFixed(2)}`;
    const cls = week.daysDone && week.daysDone[i] ? 'seg-done' : (week.todayIndex === i ? 'seg-today' : 'seg-off');
    parts.push(`<path class="${cls}" d="M${p(a0)} A44 44 0 0 1 ${p(a1)}"/>`);
  }
  const node = svg(parts.join(''), '0 0 100 100');
  node.classList.add('ring');
  return deco('ring', node);
}

function taskCard(c, week, now) {
  const t = c.talent;
  const L151 = raw('L151');
  const L155 = raw('L155');
  const role = raw({ main: 'L45', maintain: 'L46', dormant: 'L47' }[t.role]);
  const parts = [
    deco('titlebar', el('span', { class: 'tb-box' }), el('span', { class: 'tb-name' }, t.name)),
    deco('binding', [1, 2, 3, 4].map(() => el('span', { class: 'hole' }))),
    deco('sender', `${raw('L152')} · ${t.name} · ${role} · ${rankText(t)}`),
    deco('quest', raw('L150')),
    deco('stamp', text('L48', { rank: t.rank })),
    deco('emblem', t.rank),
    el('div', { class: 'card-head' }, deco('col', L151[0]), nameRow(t, now)),
    ...hintFor(t, now),
  ];
  if (c.inst && c.mode === 'past') {
    // Neutral note with the original slot time: no "missed", no red (spec 5.1.1 item 3).
    parts.push(el('p', { class: 'muted small' }, text('S72', { day: dayLabel(c.inst.start, now), time: hm(c.inst.start) })));
  }
  parts.push(el('div', { class: 'card-target' },
    deco('col', L151[2]),
    weekRing(week),
    el('span', { class: 'part-label small muted' }, el('span', { class: 'label-word' }, raw('L97')), deco('short', L155[0])),
    bigNumber(t, t.target),
    el('span', { class: 'card-focus' }, deco('col', L151[3]), t.focus),
    t.lastPass ? el('span', { class: 'muted small last-pass' }, deco('short', L155[1]), text('S140', { value: fmtValue(t, t.lastPass.value), day: dayLabel(new Date(t.lastPass.at), now) })) : null));
  const checks = (t.checks || []).filter(Boolean);
  const nw = needsWorkPart(t);
  if (checks.length || nw) parts.push(el('hr', { class: 'rule' }));
  if (checks.length) {
    parts.push(el('div', { class: 'card-part card-checks' },
      deco('col', L151[4]),
      el('span', { class: 'part-label small muted' }, raw('L98')),
      ...checks.map((s) => el('span', { class: 'check-line' }, s))));
  }
  if (nw) parts.push(nw);
  if (state.player.returnActive) parts.push(el('p', {}, text('S151')));
  if (week.atRisk) parts.push(el('p', { class: 'muted small' }, text('S07', { done: week.done, planned: week.planned })));
  return parts;
}

function findStartCard(c, now, onInput) {
  const t = c.talent;
  const input = el('input', {
    type: 'text', inputmode: 'decimal', class: 'num start-input', value: ui.startInputs[t.id] || '', autocomplete: 'off',
  });
  // S297 replaces S155 while the number is too close to the goal (spec 6.17).
  const hint = el('p', { class: 'muted small' });
  const paintHint = () => { hint.textContent = text(tooCloseToGoal(t, parseNumber(input.value)) ? 'S297' : 'S155'); };
  paintHint();
  input.addEventListener('input', () => {
    ui.startInputs[t.id] = input.value;
    paintHint();
    onInput();
  });
  return [
    nameRow(t, now),
    c.inst && c.mode === 'past' ? el('p', { class: 'muted small' }, text('S72', { day: dayLabel(c.inst.start, now), time: hm(c.inst.start) })) : null,
    el('p', { class: 'start-big' }, text('S152')),
    el('p', {}, text('S153', { focus: t.focus, value: fmtValue(t, shownTarget(t)) })),
    el('p', { class: 'muted small' }, text('S154')),
    el('div', { class: 'start-row' }, input, t.unit ? el('span', { class: 'muted' }, t.unit) : null),
    hint,
  ];
}

function setupCard(c, now) {
  return [nameRow(c.talent, now), el('p', { class: 'setup-line' }, text('S157', { talent: c.talent.name }))];
}

// ---- State cards (5.1.3) ----

function nextSlotLines(now) {
  const next = nextSlot(state, now);
  if (!next) return [el('p', { class: 'muted' }, text('S280'))];
  const day = dayLabel(next.start, now);
  const time = hm(next.start);
  const lines = [el('span', { class: 'part-label small muted' }, raw('L106'))];
  if (next.slot.anchor) {
    lines.push(el('p', {}, text('S159', { day, anchor: next.slot.anchor })));
    lines.push(el('p', {}, text('S160', { time, talent: next.talent.name })));
  } else {
    lines.push(el('p', {}, text('S161', { day, time, talent: next.talent.name })));
  }
  const value = fmtValue(next.talent, shownTarget(next.talent));
  if (value) lines.push(el('p', { class: 'muted' }, text('S162', { value })));
  return lines;
}

function recordLine(r) {
  const t = state.talents.find((x) => x.id === r.talentId);
  if (!t) return null;
  const value = fmtValue(t, r.value);
  if (r.kind === 'quick') return text('S260', { talent: t.name });
  if (r.kind === 'findStart') return text('S288', { talent: t.name, value });
  if (r.kind === 'practice' && r.result === 'passed') return text('S258', { talent: t.name, value });
  if (r.kind === 'practice' && r.result === 'notYet') return text('S259', { talent: t.name, value });
  return t.name; // records from before version 0.8 have no result
}

function stateCardNode(kind, now) {
  if (kind === 'allDone') {
    return el('div', { class: 'card' },
      el('div', { class: 'card-name' },
        el('span', { class: 'talent-name' }, text('S158')),
        el('span', { class: 'tag tag-solid small' }, raw('L103'))),
      ...todaysRecords(state, now).map((r) => el('p', { class: 'small' }, recordLine(r))),
      el('hr', { class: 'rule' }),
      ...nextSlotLines(now));
  }
  if (kind === 'later') {
    return el('div', { class: 'card' },
      el('p', { class: 'talent-name' }, text('S303')),
      ...todaysRecords(state, now).map((r) => el('p', { class: 'small' }, recordLine(r))),
      el('p', { class: 'muted' }, text('S304')),
      el('hr', { class: 'rule' }),
      ...nextSlotLines(now));
  }
  if (kind === 'noSlot') {
    return el('div', { class: 'card' },
      el('p', { class: 'talent-name' }, text('S163')),
      el('p', { class: 'muted' }, text('S164')),
      el('hr', { class: 'rule' }),
      ...nextSlotLines(now));
  }
  const dormant = kind === 'allDormant';
  return el('div', { class: 'card' },
    el('p', { class: 'talent-name' }, text(dormant ? 'S278' : 'S165')),
    el('p', { class: 'muted' }, text(dormant ? 'S279' : 'S166')));
}

// ---- Bottom buttons (always act on the card on show) ----

const btn = (label, onClick, cls = 'btn') => el('button', { type: 'button', class: cls, onclick: onClick }, label);

function bottomFor(c, now, refreshBottom) {
  if (!c) return null;
  const quick = btn(raw('L101'), () => openQuick(c, now));
  const more = btn(raw('L102'), () => openMore(c, now));
  let primary;
  if (c.kind === 'setup') {
    primary = btn(raw('L105'), () => app.setup(c.talent.id), 'btn btn-primary btn-main');
  } else if (c.kind === 'findStart') {
    const value = parseNumber(ui.startInputs[c.talent.id]);
    primary = btn(raw('L104'), async () => {
      const v = parseNumber(ui.startInputs[c.talent.id]);
      if (v === null) return;
      const ok = await completePractice({
        kind: 'findStart', talentId: c.talent.id, inst: c.inst, value: v,
      });
      if (ok) delete ui.startInputs[c.talent.id];
      else if (!tooCloseToGoal(c.talent, v)) refreshBottom(text('S243'));
    }, 'btn btn-primary btn-main');
    primary.disabled = value === null || tooCloseToGoal(c.talent, value);
  } else if (state.player.returnActive) {
    // Return (6.16): Quick is the main button; I practiced moves next to More.
    return el('div', { class: 'today-bottom' },
      btn(raw('L101'), () => openQuick(c, now), 'btn btn-primary btn-main'),
      el('div', { class: 'btn-pair' }, btn(raw('L100'), () => openReport(c, now)), more));
  } else {
    primary = btn([deco('accept', `${raw('L153')} · `), raw('L100')], () => openReport(c, now), 'btn btn-primary btn-main');
  }
  return el('div', { class: 'today-bottom' }, primary, el('div', { class: 'btn-pair' }, quick, more));
}

function stateBottom(kind, now) {
  const next = nextSlot(state, now);
  const nextTalent = next ? next.talent : state.talents.find((t) => t.role !== 'dormant');
  const asCard = nextTalent ? {
    talent: nextTalent, inst: instanceForTalent(state, nextTalent.id, now), kind: 'task', stateCard: true, next,
  } : null;
  if (kind === 'allDone') {
    return el('div', { class: 'today-bottom' }, el('div', { class: 'btn-pair' },
      btn(raw('L107'), () => otherTalentSheet(null, now)),
      btn(raw('L102'), () => openMore(asCard, now))));
  }
  if (kind === 'noSlot' || kind === 'later') {
    return el('div', { class: 'today-bottom' },
      btn(raw('L108'), () => {
        // Practice the talent of the next slot now (spec 6.9).
        if (asCard.talent.needsSetup || asCard.talent.start === null || asCard.talent.findStart) focusTalent(asCard.talent.id);
        else openReport(asCard, now);
      }, 'btn btn-primary btn-main'),
      el('div', { class: 'btn-pair' },
        btn(raw('L101'), () => openQuick(asCard, now)),
        btn(raw('L102'), () => openMore(asCard, now))));
  }
  if (kind === 'allDormant') {
    return el('div', { class: 'today-bottom' }, btn(raw('L19'), () => app.tab('talents'), 'btn btn-primary btn-main'));
  }
  return el('div', { class: 'today-bottom' }, btn(raw('L109'), () => app.addTalent(), 'btn btn-primary btn-main'));
}

// ---- Swipe between cards (spec 5.1 item 3, 3.3) ----

function swipeTrack(cardNodes, index, onChange) {
  const track = el('div', { class: 'card-track' }, cardNodes.map((n) => el('div', { class: 'card-slide' }, n)));
  const viewport = el('div', { class: 'card-viewport' }, track);
  let at = index;
  const place = (dx = 0, animate = false) => {
    track.style.transition = animate ? 'transform 250ms ease-out' : 'none';
    track.style.transform = `translateX(calc(${-at * 100}% + ${dx}px))`;
  };
  place();
  if (cardNodes.length < 2) return { node: viewport, go: () => {} };
  let x0 = null;
  let y0 = null;
  let horizontal = null;
  viewport.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t.clientX < 24 || (e.target.closest && e.target.closest('input'))) return; // keep the edge for the system back gesture
    x0 = t.clientX;
    y0 = t.clientY;
    horizontal = null;
  }, { passive: true });
  viewport.addEventListener('touchmove', (e) => {
    if (x0 === null) return;
    const t = e.touches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) horizontal = Math.abs(dx) > Math.abs(dy);
    if (horizontal) {
      e.preventDefault();
      place(dx);
    }
  }, { passive: false });
  viewport.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (!horizontal) return;
    const w = viewport.offsetWidth || 1;
    if (dx < -w * 0.2 && at < cardNodes.length - 1) at += 1;
    else if (dx > w * 0.2 && at > 0) at -= 1;
    place(0, true);
    onChange(at);
  });
  return {
    node: viewport,
    go: (i) => {
      at = i;
      place(0, true);
      onChange(at);
    },
  };
}

function dotsAndHint(cards, at) {
  if (cards.length < 2) return el('div', { class: 'card-foot' });
  const other = at < cards.length - 1 ? cards[at + 1] : cards[at - 1];
  return el('div', { class: 'card-foot' },
    el('div', { class: 'dots', 'aria-hidden': 'true' }, cards.map((_, i) => el('span', { class: `dot${i === at ? ' on' : ''}` }))),
    el('p', { class: 'muted small' }, text('S143', { talent: other.talent.name })));
}

// ---- Render ----

/**
 * Draw Today. With refresh (the clock or a return from the background), nothing is redrawn
 * unless something on the screen changed (spec 3.3: no timed flashing).
 */
export function renderToday(root, { refresh = false } = {}) {
  const now = new Date();
  if (sundayCardDue(state, now)) {
    paint(root, renderSundayCard(now), refresh);
    return;
  }
  sameSlotsNotice(now);
  if (ui.extraId && !state.talents.some((t) => t.id === ui.extraId && t.role !== 'dormant')) ui.extraId = null;
  const { cards, week } = todayCards(state, now, ui.extraId);
  const wkStart = weekKey(now);
  const doneDays = new Set(state.sessions.filter((r) => weekKey(new Date(recordAt(r))) === wkStart).map((r) => dateKey(new Date(recordAt(r)))));
  week.daysDone = [0, 1, 2, 3, 4, 5, 6].map((i) => doneDays.has(dateKey(addDays(fromDateKey(wkStart), i))));
  week.todayIndex = [0, 1, 2, 3, 4, 5, 6].find((i) => dateKey(addDays(fromDateKey(wkStart), i)) === dateKey(now));

  const section = el('section', { class: `today${refresh ? '' : ' fade-in'}` }, titleRow(),
    el('div', { class: 'week' }, weekHeader(week), weekCells(week, now)));

  if (!cards.length) {
    const kind = stateCard(state, now);
    section.append(el('div', { class: 'card-viewport' }, el('div', { class: 'card-slide' }, stateCardNode(kind, now))),
      el('div', { class: 'card-foot' }), stateBottom(kind, now));
    paint(root, section, refresh);
    return;
  }

  let at = Math.max(0, cards.findIndex((c) => c.talent.id === ui.currentId));
  ui.currentId = cards[at].talent.id;
  let bottom = null;
  let foot = dotsAndHint(cards, at);
  const replaceBottom = (note) => {
    const next = bottomFor(cards[at], now, replaceBottom);
    if (note && next) next.prepend(el('p', { class: 'muted small' }, note));
    if (bottom) bottom.replaceWith(next);
    bottom = next;
  };
  const nodes = cards.map((c) => {
    const parts = c.kind === 'setup' ? setupCard(c, now)
      : c.kind === 'findStart' ? findStartCard(c, now, () => { if (cards[at] === c) replaceBottom(); })
        : taskCard(c, week, now);
    const i = cards.indexOf(c);
    return el('div', {
      class: `card${c.talent.role === 'main' ? ' card-main' : ''}${i < cards.length - 1 ? ' has-next' : ''}`,
    }, cards.length > 1 ? deco('pos', text('L154', { i: i + 1, n: cards.length })) : null, parts);
  });
  const track = swipeTrack(nodes, at, (i) => {
    at = i;
    ui.currentId = cards[at].talent.id;
    const f = dotsAndHint(cards, at);
    if (tabs) [...tabs.children].forEach((b, k) => b.classList.toggle('on', k === at));
    foot.replaceWith(f);
    foot = f;
    replaceBottom();
  });
  replaceBottom();
  // Folder: tabs with every card's talent; tapping one shows it (spec 3.2 rule 7).
  const tabs = cards.length > 1 ? el('div', { class: 'deco deco-tabs' }, cards.map((c, i) => el('button', {
    type: 'button', class: `ftab${i === at ? ' on' : ''}`, onclick: () => track.go(i),
  }, c.talent.name))) : null;
  section.append(...[tabs, track.node, foot, bottom].filter(Boolean));
  paint(root, section, refresh);
}

function paint(root, section, refresh) {
  // Same content as on screen: leave the screen alone.
  const signature = section.textContent + section.querySelectorAll('.done,.on,[disabled]').length;
  if (refresh && signature === ui.signature && root.firstChild) return;
  ui.signature = signature;
  mount(root, section);
}

export function forgetTodaySignature() {
  ui.signature = null;
}
