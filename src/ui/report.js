// Sheets opened from Today: report after practice (5.3.1), Quick (6.5), More (5.1.4), Other talent.

import { el } from '../dom.js';
import { text, raw } from '../text.js';
import { fmtValue } from '../format.js';
import {
  state, talentById, savePlayer, saveTalent, newId,
} from '../store.js';
import { shownTarget } from '../model/practice.js';
import { todayCards } from '../model/today.js';
import { STAR, challengeEntry } from '../model/challenge.js';
import {
  openSheet, closeSheet, textInput, toggle,
} from './widgets.js';
import { rescheduleSheet } from './sheets.js';
import { completePractice } from './finish.js';
import { focusTalent } from './today.js';
import { app } from './app.js';

const roleLabel = (role) => raw({ main: 'L45', maintain: 'L46', dormant: 'L47' }[role]);

/** A one-time line (S186, S187); marks it seen. */
function firstTime(key) {
  const seen = state.player.seenExplanations || [];
  if (seen.includes(key)) return null;
  savePlayer({ ...state.player, seenExplanations: [...seen, key] });
  return el('p', { class: 'muted small' }, text(key));
}

/** Add one Needs work line to a talent (spec 6.6). */
export async function addNeedsWork(talentId, value) {
  const t = talentById(talentId);
  await saveTalent({ ...t, needsWork: [...(t.needsWork || []), { id: newId(), text: value, createdAt: Date.now() }] });
}

// ---- Challenge first? (5.3.3) ----

/** Before practice or Quick: offer an open challenge once per rank. Returns true when shown. */
function challengeFirst(card, now, then) {
  const t = talentById(card.talent.id);
  const entry = challengeEntry(state, t, now);
  const asked = (t.challenge && t.challenge.askedFirst) || [];
  if (!entry || !entry.ready || asked.includes(entry.rank)) return false;
  openSheet([
    el('h2', { class: 'sheet-title' }, text('S191')),
    el('p', { class: 'muted' }, text('S192', { rank: entry.rank === STAR ? 'S' : entry.rank })),
    el('button', { type: 'button', class: 'btn btn-primary btn-main', onclick: () => { closeSheet({ instant: true }); app.challenge(t.id); } }, raw('L119')),
    el('button', {
      type: 'button',
      class: 'btn',
      onclick: async () => {
        const cur = talentById(t.id);
        await saveTalent({ ...cur, challenge: { ...cur.challenge, askedFirst: [...asked, entry.rank] } });
        closeSheet({ instant: true });
        then();
      },
    }, raw('L108')),
  ]);
  return true;
}

// ---- Report (5.3.1): tap Passed or Not yet and it is saved ----

export function openReport(card, now, opts = {}) {
  if (!opts.skipFirst && challengeFirst(card, now, () => openReport(card, now, { skipFirst: true }))) return;
  const { seenLine = null } = opts;
  const talent = talentById(card.talent.id);
  const checks = (talent.checks || []).filter(Boolean);
  const missed = new Set();
  const once = seenLine || firstTime('S186');

  const checkRows = checks.map((c) => {
    const sw = toggle(true, (on) => {
      if (on) missed.delete(c);
      else missed.add(c);
    }, c);
    return el('label', { class: 'row' }, el('span', { class: 'row-label' }, c), sw);
  });

  const report = (result) => async (e) => {
    e.currentTarget.disabled = true;
    closeSheet({ instant: true });
    await completePractice({
      kind: 'practice', talentId: talent.id, inst: card.inst, result, checksMissed: checks.filter((c) => missed.has(c)),
    });
  };

  const extra = el('div', { class: 'stack' });
  const addNw = el('button', {
    type: 'button',
    class: 'btn-text',
    onclick: () => {
      const input = textInput('', { maxlength: 120 });
      const save = el('button', {
        type: 'button',
        class: 'btn',
        onclick: async () => {
          const v = input.value.trim();
          if (!v) {
            input.focus();
            return;
          }
          await addNeedsWork(talent.id, v);
          extra.replaceChildren(); // back to the same sheet, no result chosen yet
        },
      }, raw('L21'));
      extra.replaceChildren(input, save);
      input.focus();
    },
  }, raw('L113'));

  openSheet([
    el('h2', { class: 'sheet-title' }, text('S167')),
    once,
    el('p', { class: 'muted' }, text('S168', { value: fmtValue(talent, talent.target), focus: talent.focus })),
    checks.length ? el('p', { class: 'small muted' }, text('S169')) : null,
    checks.length ? el('div', { class: 'group-card' }, checkRows) : null,
    el('div', { class: 'btn-pair btn-pair-big' },
      el('button', { type: 'button', class: 'btn btn-primary', onclick: report('passed') }, raw('L111')),
      el('button', { type: 'button', class: 'btn btn-outline', onclick: report('notYet') }, raw('L112'))),
    addNw,
    extra,
  ].filter(Boolean));
}

// ---- Quick (6.5) ----

export function openQuick(card, now, opts = {}) {
  if (!card) return;
  if (!opts.skipFirst && challengeFirst(card, now, () => openQuick(card, now, { skipFirst: true }))) return;
  const talent = talentById(card.talent.id);
  const value = fmtValue(talent, shownTarget(talent));
  const oldest = (talent.needsWork || []).slice().sort((a, b) => a.createdAt - b.createdAt)[0];
  const once = firstTime('S187');
  const options = [
    value ? text('S190', { value }) : null,
    oldest ? oldest.text : null,
  ].filter(Boolean).map((label) => {
    // A choice is only a hint; nothing is recorded about it.
    const b = el('button', { type: 'button', class: 'btn btn-row' }, label);
    b.addEventListener('click', () => {
      b.parentNode.querySelectorAll('.btn-row').forEach((x) => x.classList.toggle('on', x === b));
    });
    return b;
  });
  openSheet([
    el('h2', { class: 'sheet-title' }, raw('L101')),
    once,
    el('p', {}, text('S188')),
    el('p', { class: 'muted small' }, text('S189')),
    el('div', { class: 'stack' }, options),
    el('button', {
      type: 'button',
      class: 'btn btn-primary btn-main',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        closeSheet({ instant: true });
        await completePractice({ kind: 'quick', talentId: talent.id, inst: card.inst });
      },
    }, raw('L02')),
  ].filter(Boolean));
  void now;
}

// ---- Other talent (5.1.4) ----

/** The list sheet: each non-dormant talent with role and today's target. exceptId: the card on show. */
export function otherTalentSheet(exceptId, now) {
  const list = state.talents.filter((t) => t.role !== 'dormant' && t.id !== exceptId);
  void now;
  openSheet([
    el('h2', { class: 'sheet-title' }, raw('L77')),
    el('div', { class: 'group-card' }, list.map((t) => el('button', {
      type: 'button',
      class: 'row row-tap',
      onclick: () => {
        closeSheet({ instant: true });
        focusTalent(t.id);
      },
    },
    el('span', { class: 'row-main' }, el('span', { class: 'row-label' }, t.name), el('span', { class: 'row-sub muted small' }, roleLabel(t.role))),
    el('span', { class: 'row-value muted num' }, fmtValue(t, shownTarget(t)) || ''),
    el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›')))),
  ]);
}

// ---- More (5.1.4) ----

export function openMore(card, now) {
  const running = state.talents.filter((t) => t.role !== 'dormant');
  const rows = [];
  if (card && running.length > 1) {
    const { cards } = todayCards(state, now);
    const without = running.filter((t) => t.id !== card.talent.id && !cards.some((c) => c.talent.id === t.id)).map((t) => t.name);
    rows.push(el('button', { type: 'button', class: 'row row-tap', onclick: () => otherTalentSheet(card.talent.id, now) },
      el('span', { class: 'row-label' }, raw('L77')),
      el('span', { class: 'row-value muted clip' }, without.join(' · ')),
      el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›')));
  }
  // Reschedule: the card's slot; on a state card, the next slot.
  const inst = card && card.stateCard ? card.next : card && card.inst;
  if (inst && !inst.done) {
    rows.push(el('button', {
      type: 'button',
      class: 'row row-tap',
      onclick: () => rescheduleSheet(inst, () => app.refresh({ force: true })),
    }, el('span', { class: 'row-label' }, raw('L07')), el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›')));
  }
  if (card && !card.stateCard) {
    rows.push(el('button', {
      type: 'button',
      class: 'row row-tap',
      onclick: () => {
        closeSheet({ instant: true });
        app.needsWork(card.talent.id);
      },
    }, el('span', { class: 'row-label' }, raw('L120')), el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›')));
  }
  if (card) {
    rows.push(el('button', {
      type: 'button',
      class: 'row row-tap',
      onclick: () => {
        closeSheet({ instant: true });
        app.talent(card.talent.id);
      },
    }, el('span', { class: 'row-label' }, raw('L121')), el('span', { class: 'chev muted', 'aria-hidden': 'true' }, '›')));
  }
  openSheet([
    rows.length ? el('div', { class: 'group-card' }, rows) : null,
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ].filter(Boolean));
}
