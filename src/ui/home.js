// Today (spec 5.1, 6.2-6.4, 6.9): top row, system card, switch buttons, size dots, Start.
// One screen high, no scrolling, nothing about companions.
// Talents tab (spec 5.2): This Week and the talent list.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import {
  DAY, addDays, dateKey, dayLabel, fromDateKey, hm, isoWeekday, weekKey, weekdayLabel, at,
} from '../time.js';
import {
  state, attrsOf, newId, saveActive, savePlayer, saveWeek, weekRecord, updateOpenMetric, saveAttribute,
} from '../store.js';
import { eligibility, nextDue } from '../model/trials.js';
import { badgeIcon, titleNode } from './appearance.js';
import {
  decideCard, orderAttributes, otherTalents, instanceForTalent,
} from '../model/card.js';
import { instancesForWeek, isOnTime, instanceStatus } from '../model/schedule.js';
import {
  sizeFromMinutes, sizeLine, sizeMinutes, taskSentence, SIZES,
} from '../model/tasks.js';
import { knobProgress } from '../model/knobs.js';
import { buildActive, levelFromExp } from '../model/session.js';
import { unlockAudio } from '../metronome.js';
import {
  onLongPress, onSwipe, bar, openSheet, closeSheet,
} from './widgets.js';
import { rescheduleSheet, slotEditSheet, talentMenu } from './sheets.js';
import { app } from './app.js';

// Card UI state survives re-renders while the same card is shown.
// shift: L76 presses; alt: talent picked with L77 (spec 6.4).
let cardUi = {
  id: null, size: null, shift: 0, alt: null, message: null,
};

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function rankText(talent) {
  const stars = talent.rank === 'S' && talent.stars ? ` ★${talent.stars}` : '';
  return text('L48', { rank: talent.rank }) + stars;
}

export function roleLabel(role) {
  return raw({ main: 'L45', maintain: 'L46', dormant: 'L47' }[role]);
}

/** Mark a one-time explanation as seen (S60-S63). */
function markSeen(key) {
  const p = state.player;
  if ((p.seenExplanations || []).includes(key)) return;
  savePlayer({ ...p, seenExplanations: [...(p.seenExplanations || []), key] });
}

function cardId(card) {
  if (card.type === 'return') return `return:${cardId(card.base)}`;
  if (card.type === 'trial') return `trial:${card.talent.id}:${card.kind}`;
  if (card.type === 'slot' || card.type === 'next') return `${card.type}:${card.inst.key}`;
  if (card.type === 'free') return `free:${card.talent.id}`;
  return card.type;
}

/** S32 once for each attribute whose Plateau Dungeon week just ended. */
function plateauEndNotes() {
  const notes = [];
  for (const t of state.talents) {
    for (const a of attrsOf(t.id)) {
      if (a && a.plateauEndedAt && !a.plateauEndShown) {
        notes.push(text('S32', { talent: t.name, attribute: a.name }));
        saveAttribute({ ...a, plateauEndShown: true });
      }
    }
  }
  return notes;
}

// ---------------- Today ----------------

export function renderToday(root) {
  const now = new Date();
  const card = decideCard(state, now);
  const id = cardId(card);
  if (cardUi.id !== id) {
    const message = cardUi.message;
    cardUi = {
      id, size: null, shift: 0, alt: null, message,
    };
  }
  mount(root, renderFocus(card, now));
  cardUi.message = null;
}

function topRow(card) {
  const p = state.player;
  const main = state.talents.find((t) => t.role === 'main');
  return el('div', { class: 'top-row' },
    el('span', { class: 'top-left' },
      badgeIcon((p.equipped && p.equipped.badge) || 'circle'),
      el('span', { class: 'num' }, text('S50', { lv: levelFromExp(p.totalExp), talent: main && main.name, rank: main && main.rank })),
      titleNode(p)),
    el('span', { class: 'num' }, text('S51', { done: card.week.done, planned: card.week.planned })));
}

/** The task underneath the card, after an L77 switch (spec 6.3, 6.4 item 4). */
function switchedTask(task, now) {
  if (!cardUi.alt) return task;
  const talent = state.talents.find((t) => t.id === cardUi.alt);
  if (!talent || talent.role === 'dormant' || !orderAttributes(attrsOf(talent.id)).length) {
    cardUi.alt = null;
    return task;
  }
  const found = instanceForTalent(state, talent.id, now);
  if (!found) return { type: 'free', talent, switched: true };
  return {
    type: 'slot', mode: found.mode, inst: found.inst, switched: true,
  };
}

function taskTalent(task) {
  return task.type === 'free' ? task.talent : task.inst.talent;
}

function renderFocus(card, now) {
  const p = state.player;
  const top = topRow(card);

  const notes = [];
  const sameSlots = sameSlotsNotice(now);
  if (sameSlots) notes.push(el('p', { class: 'muted small' }, sameSlots));
  for (const n of plateauEndNotes()) notes.push(el('p', { class: 'muted small' }, n));
  if (cardUi.message) notes.push(el('p', { class: 'muted small' }, cardUi.message));

  if (card.type === 'sunday') return el('section', { class: 'focus fade-in' }, top, ...notes, renderSundayCard(now));
  if (card.type === 'empty') {
    return el('section', { class: 'focus fade-in' }, top, ...notes,
      el('div', { class: 'card frame' },
        el('button', { type: 'button', class: 'btn', onclick: () => app.addTalent() }, raw('L20'))));
  }

  // Trial card (S20), new-piece baseline (S08), or first baseline replacing a slot card (S08).
  const baselineSlot = card.type === 'slot' && card.baseline;
  if (card.type === 'trial' || baselineSlot) {
    const talent = card.type === 'trial' ? card.talent : card.inst.talent;
    const kind = card.type === 'trial' ? card.kind : 'baseline';
    const line = kind === 'baseline'
      ? text('S08', { talent: talent.name, piece: talent.trialWork })
      : text('S20', { talent: talent.name, piece: talent.trialWork });
    const showReschedule = baselineSlot && card.mode === 'past';
    const cardNode = el('div', { class: 'card frame' },
      showReschedule ? el('button', { type: 'button', class: 'card-corner btn-text small', onclick: () => openReschedule(card) }, raw('L07')) : null,
      el('p', { class: 'task' }, line));
    if (baselineSlot) onSwipe(cardNode, { right: () => openReschedule(card) });
    const startBtn = el('button', {
      type: 'button',
      class: 'btn btn-invert btn-start',
      onclick: () => {
        markStartPressed();
        app.trial({ talentId: talent.id, kind });
      },
    }, raw('L01'));
    return el('section', { class: 'focus fade-in' }, top, ...notes, cardNode, el('div', { class: 'focus-bottom' }, startBtn));
  }

  // Task cards: slot (in / past), next, free; the return card wraps one of them.
  const isReturn = card.type === 'return';
  const task = switchedTask(isReturn ? card.base : card, now);
  const talent = taskTalent(task);
  const ordered = orderAttributes(attrsOf(talent.id));
  const attr = ordered[cardUi.shift % ordered.length];
  const slotMin = task.type === 'free' ? sizeMinutes('standard') : task.inst.slot.length;
  let defaultSize = sizeFromMinutes(slotMin);
  if (!task.switched) {
    if (card.week.atRisk && task.type !== 'free') defaultSize = 'mini';
    if (isReturn) defaultSize = 'mini';
  }
  const size = cardUi.size || defaultSize;

  const lines = [];
  if (isReturn) {
    lines.push(el('p', { class: 'line1' }, text('S33')));
    lines.push(el('p', { class: 'small' }, text('S34')));
  }
  if (attr.plateau) lines.push(el('p', { class: 'small' }, text('S31', { talent: talent.name, attribute: attr.name })));
  if (task.type === 'slot' && task.mode === 'past') {
    // Neutral note with the original slot time (spec 6.2 item 4): no "missed", no red.
    lines.push(el('p', { class: 'muted small' }, text('S72', { day: dayLabel(task.inst.start, now), time: hm(task.inst.start) })));
  }
  if (task.type === 'slot' || isReturn || task.switched) {
    lines.push(el('p', { class: 'line1' }, text('S01', { talent: talent.name, attribute: attr.name })));
    lines.push(el('p', { class: 'task' }, taskSentence(attr, size)));
    lines.push(el('p', { class: 'muted num' }, sizeLine(size)));
  } else {
    if (task.type === 'next') {
      const { inst } = task;
      const day = dayLabel(inst.start, now);
      const time = hm(inst.start);
      let first;
      if (task.todayDone) first = text('S06', { day, time });
      else if (inst.slot.anchor) first = text('S04', { day, anchor: inst.slot.anchor, time });
      else first = text('S65', { day, time });
      lines.push(el('p', { class: 'line1' }, first));
    }
    lines.push(el('p', { class: 'task' }, text('S05', { talent: talent.name, attribute: attr.name, min: sizeMinutes(size) })));
    if (task.type === 'next') {
      lines.push(el('button', { type: 'button', class: 'btn-text small', onclick: () => start(task, talent, attr, size) }, raw('L09')));
    }
  }
  if (isReturn) {
    lines.push(el('button', { type: 'button', class: 'btn-text small', onclick: () => app.talent(talent.id) }, raw('L22')));
  }

  const canReschedule = task.type === 'slot' || task.type === 'next';
  const showReschedule = (task.type === 'slot' && task.mode === 'past') || task.type === 'next';
  const cardNode = el('div', { class: 'card frame' },
    showReschedule ? el('button', { type: 'button', class: 'card-corner btn-text small', onclick: () => openReschedule(task) }, raw('L07')) : null,
    ...lines);

  const canShift = cardUi.shift < 2 && ordered.length >= 2;
  const switchAttribute = () => {
    if (!canShift) return;
    cardUi.shift += 1;
    app.refresh();
  };
  // Swipes stay as shortcuts (spec 5.1 item 6).
  onSwipe(cardNode, {
    left: switchAttribute,
    right: () => {
      if (canReschedule) openReschedule(task);
    },
  });

  // L76 / L77 right under the card (spec 5.1 item 3).
  const others = otherTalents(state, talent.id);
  const switchRow = el('div', { class: 'card-switch' },
    el('button', {
      type: 'button', class: 'btn-text small', disabled: !canShift || undefined, onclick: switchAttribute,
    }, raw('L76')),
    others.length ? el('button', { type: 'button', class: 'btn-text small', onclick: () => otherTalentSheet(others) }, raw('L77')) : null);

  const below = [];
  if (card.week.atRisk && task.type !== 'free' && !isReturn && !task.switched) {
    below.push(el('p', { class: 'muted small' }, text('S07', { done: card.week.done, planned: card.week.planned })));
  }

  const dots = el('div', { class: 'dots' }, SIZES.map((s) => el('button', {
    type: 'button',
    class: `dot num${s === size ? ' on' : ''}`,
    'aria-pressed': s === size ? 'true' : 'false',
    onclick: () => {
      cardUi.size = s;
      app.refresh();
    },
  }, text('L43', { min: sizeMinutes(s) }))));

  const explain = [];
  if (!(p.seenExplanations || []).includes('S63')) {
    explain.push(el('p', { class: 'muted small' }, text('S63')));
    markSeen('S63');
  }

  const startBtn = el('button', { type: 'button', class: 'btn btn-invert btn-start', onclick: () => start(task, talent, attr, size) }, raw('L01'));

  return el('section', { class: 'focus fade-in' },
    top,
    ...notes,
    cardNode,
    switchRow,
    ...below,
    el('div', { class: 'focus-bottom' }, dots, ...explain, startBtn));
}

/** L77: the other non-dormant talents, each with the attribute it would practice (spec 6.4). */
function otherTalentSheet(others) {
  openSheet(el('div', { class: 'stack' }, others.map((t) => {
    const first = orderAttributes(attrsOf(t.id))[0];
    return el('button', {
      type: 'button',
      class: 'list-row',
      onclick: () => {
        closeSheet();
        cardUi.alt = t.id;
        cardUi.shift = 0;
        cardUi.size = null;
        app.refresh();
      },
    },
    el('span', { class: 'talent-name' }, t.name),
    el('span', { class: 'muted small' }, `${roleLabel(t.role)} · ${first.name}`));
  })));
}

/** Validation metric: seconds from opening the app to the first Start (spec 4.12). */
function markStartPressed() {
  if (state.startPressedThisOpen) return;
  state.startPressedThisOpen = true;
  updateOpenMetric({ secondsToStart: Math.round((Date.now() - state.openedAt) / 1000) });
}

function openReschedule(card) {
  rescheduleSheet(card.inst, (message) => {
    cardUi.message = message;
    app.refresh();
  });
}

/** S38 once, on the first open of a week when last week's Sunday card was left alone. */
function sameSlotsNotice(now) {
  const wk = weekKey(now);
  const rec = weekRecord(wk);
  if (rec.sameSlotsNoticeShown) return null;
  const prevWk = dateKey(addDays(fromDateKey(wk), -7));
  const prev = state.weeks.get(prevWk);
  const prevSundayCard = at(dateKey(addDays(fromDateKey(prevWk), 6)), `${CONFIG.sundayCardHour}:00`);
  const wasUsing = state.player.firstOpenedAt < prevSundayCard.getTime();
  if (!wasUsing || (prev && prev.nextWeekConfirmed) || state.slots.length === 0) return null;
  saveWeek({ ...rec, sameSlotsNoticeShown: true });
  return text('S38');
}

async function start(card, talent, attr, size) {
  unlockAudio();
  const now = new Date();
  let inst = null;
  let onTime = null;
  if (card.type === 'slot') {
    inst = card.inst;
    onTime = card.mode === 'in' && isOnTime(inst, now);
  } else if (card.type === 'next' && card.inst.wk === weekKey(now)) {
    // "Do it now": the next open instance of this week (spec 6.3).
    inst = card.inst;
    onTime = false;
  }
  const active = buildActive({
    id: newId(), talent, attrs: attrsOf(talent.id), attr, size, inst, onTime, now,
  });
  await saveActive(active);
  markStartPressed();
  app.timer(active);
}

// ---------------- Sunday card (spec 6.9) ----------------

function renderSundayCard(now) {
  const wk = weekKey(now);
  const nextWk = dateKey(addDays(fromDateKey(wk), 7));
  const next = instancesForWeek(nextWk, { ...state, sessions: [] });
  const rec = weekRecord(wk);

  const rows = next.map((i) => el('button', {
    type: 'button',
    class: 'list-row',
    onclick: () => slotEditSheet(i.slot, () => app.refresh()),
  },
  el('span', {}, i.talent.name),
  el('span', { class: 'num muted' }, `${weekdayLabel(isoWeekday(i.start))} ${hm(i.start)} · ${text('L43', { min: i.slot.length })}`)));

  const parts = [el('p', { class: 'line1' }, text('S37', { count: next.length })), ...rows];

  const trial = now.getTime() - state.player.firstOpenedAt < CONFIG.trialPeriodWeeks * 7 * DAY;
  if (trial) {
    parts.push(el('p', { class: 'small' }, text('S39')));
    parts.push(el('div', { class: 'seg' }, [1, 2, 3, 4, 5].map((n) => el('button', {
      type: 'button',
      class: `seg-btn num${rec.anxiety === n ? ' on' : ''}`,
      onclick: async () => {
        await saveWeek({ ...weekRecord(wk), anxiety: n });
        app.refresh();
      },
    }, String(n)))));
  }

  const ok = el('button', {
    type: 'button',
    class: 'btn btn-primary btn-start',
    onclick: async () => {
      await saveWeek({ ...weekRecord(wk), nextWeekConfirmed: true });
      app.refresh();
    },
  }, raw('L14'));

  return el('div', { class: 'sunday' },
    el('div', { class: 'card frame card-auto' }, ...parts),
    el('div', { class: 'focus-bottom' }, ok));
}

// ---------------- Talents tab ----------------

export function renderTalentsTab(root) {
  const now = new Date();
  mount(root, el('div', { class: 'tab-page fade-in' }, renderWeek(now), renderTalents()));
}

function renderTalents() {
  const titles = raw('L60');
  let showsTrialDate = false;
  const rows = state.talents.map((t) => {
    const attrs = attrsOf(t.id);
    const due = nextDue(t);
    let trialLine = null;
    if (due) {
      // Next trial date and eligibility progress, e.g. "Dec 3 · 6/9" (spec 5.2).
      const e = eligibility(t, state);
      const date = t.retryPending && t.retryAvailableAt ? t.retryAvailableAt : due;
      trialLine = el('span', { class: 'muted small num' }, `${monthDay.format(fromDateKey(date))} · ${Math.min(e.done, e.need)}/${e.need}`);
      showsTrialDate = true;
    }
    const row = el('div', { class: 'talent-row', role: 'button', tabindex: '0' },
      el('div', { class: 'talent-head' },
        el('span', { class: 'talent-name' }, t.name),
        el('span', { class: 'muted small' }, `${roleLabel(t.role)} · ${rankText(t)}`)),
      el('div', { class: 'bars' }, attrs.map((a) => bar(knobProgress(a)))),
      trialLine);
    onLongPress(row, () => talentMenu(t, () => app.refresh()), () => app.talent(t.id));
    return row;
  });

  const explain = [];
  if (showsTrialDate && !(state.player.seenExplanations || []).includes('S61')) {
    explain.push(el('p', { class: 'muted small' }, text('S61')));
    markSeen('S61');
  }

  return el('section', { class: 'section' },
    el('h2', { class: 'section-title' }, titles[1]),
    el('p', { class: 'muted small num' }, text('S59', { count: state.player.practiceDays })),
    ...explain,
    ...rows,
    el('button', { type: 'button', class: 'btn', onclick: () => app.addTalent() }, raw('L20')));
}

function renderWeek(now) {
  const titles = raw('L60');
  const wk = weekKey(now);
  const instances = instancesForWeek(wk, state);
  const today = isoWeekday(now);
  // Column = the day it happens; an instance moved outside this week stays under its own weekday.
  const column = (i) => (i.start.getTime() >= fromDateKey(wk).getTime() && weekKey(i.start) === wk ? isoWeekday(i.start) : i.slot.weekday);
  const cols = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const cells = instances
      .filter((i) => column(i) === d)
      .map((i) => {
        const done = instanceStatus(i, now) === 'done';
        return el('button', {
          type: 'button',
          class: `week-cell num${done ? ' done' : ''}`,
          onclick: done ? undefined : () => rescheduleSheet(i, (message) => {
            cardUi.message = message;
            app.refresh();
          }),
        }, done ? `✓ ${hm(i.start)}` : hm(i.start));
      });
    return el('div', { class: `week-col${d === today ? ' today' : ''}` },
      el('span', { class: 'week-head small' }, weekdayLabel(d)), ...cells);
  });
  return el('section', { class: 'section section-first' },
    el('h2', { class: 'section-title' }, titles[0]),
    el('div', { class: 'week-grid' }, cols));
}
