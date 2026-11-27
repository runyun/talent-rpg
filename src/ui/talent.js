// Talent page and its pages (spec 5.8; part of the Talents tab): target and step, challenge entry,
// focus, checks, records (Needs work, Challenges, Fixed, Old recordings), schedule, role,
// rename (with short name), awaken and delete. Target & step (5.8.1).

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { dateKey, fmtDateKey, monthDay, weekdayLabel } from '../time.js';
import {
  fmtStep, fmtValue, parseNumber, shortNameOf,
} from '../format.js';
import {
  state, talentById, saveTalent, deleteTalent, applyUpdates, deleteMedia, addMetric, newId,
} from '../store.js';
import {
  computeRankValues, dirOf, roundValue, shownTarget,
} from '../model/practice.js';
import {
  roleAllowed, roleChange, slotUse,
} from '../model/roles.js';
import { STAR, challengeEntry } from '../model/challenge.js';
import {
  backButton, group, navRow, rankLadder, roleTag, segmented, confirmDeleteButton, swipeRow,
  onLongPress, openSheet, closeSheet, textInput, numberInput, field, toggle, showNote,
} from './widgets.js';
import {
  slotGroups, slotGroupSheet, addSlotsSheet, textSheet,
} from './sheets.js';
import { stepBlock, stepRange, stepFor } from './addTalent.js';
import { app } from './app.js';

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const roleKey = (r) => ({ main: 'L45', maintain: 'L46', dormant: 'L47' }[r]);

function pageTop() {
  return el('div', { class: 'page-top' }, backButton(() => app.back()));
}

/** Old trial records with a value (shown in Challenges, spec 4.6). */
function oldTrials(talentId) {
  return state.trials.filter((r) => r.talentId === talentId && isNum(r.value));
}

function challengeRecords(talentId) {
  return state.sessions.filter((r) => r.talentId === talentId && (r.kind === 'challenge' || r.kind === 'checkpoint'));
}

function oldRecordings(talentId) {
  return state.media.filter((m) => m.talentId === talentId);
}

// ---- Role changes (6.13, 6.18) ----

/**
 * Change a role. Becoming Main asks S55 when the old Main has slots; leaving Dormant is an
 * awakening: the next practice finds the start again (S275).
 */
export async function changeRole(t, role, onDone) {
  if (role === t.role) return;
  const awaken = t.role === 'dormant' && role !== 'dormant';
  const apply = async (moveSlots) => {
    const talents = roleChange(state, t.id, role);
    const first = talents[0];
    if (awaken && first.start !== null && first.start !== undefined) first.findStart = 'awaken';
    const slots = [];
    if (moveSlots) {
      const oldMain = talents[1];
      for (const s of state.slots.filter((x) => x.talentId === oldMain.id)) slots.push({ ...s, talentId: t.id, overrides: {} });
    }
    await applyUpdates({ talents, slots });
    if (awaken) showNote(text('S275', { talent: t.name, rank: t.rank }));
    onDone();
  };
  const oldMain = role === 'main' && state.talents.find((x) => x.role === 'main' && x.id !== t.id);
  const oldSlots = oldMain ? state.slots.filter((s) => s.talentId === oldMain.id) : [];
  if (oldSlots.length) {
    openSheet([
      el('p', {}, text('S55', { count: oldSlots.length, talent: t.name })),
      el('div', { class: 'btn-pair' },
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => { closeSheet({ instant: true }); apply(true); } }, raw('L12')),
        el('button', { type: 'button', class: 'btn', onclick: () => { closeSheet({ instant: true }); apply(false); } }, raw('L13'))),
    ]);
    return;
  }
  await apply(false);
}

/** Rename: the name and the short name for the week calendar (5.8 item 8). */
export function renameSheet(t, onDone) {
  const name = textInput(t.name, { maxlength: 60 });
  const short = textInput(t.shortName || shortNameOf(t), { maxlength: 6 });
  openSheet([
    el('h2', { class: 'sheet-title' }, raw('L18')),
    name,
    field(raw('L165'), short, el('p', { class: 'muted small' }, text('S316'))),
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: async () => {
        const v = name.value.trim();
        if (!v) return;
        const s = [...short.value.trim()].slice(0, 6).join('');
        await saveTalent({ ...talentById(t.id), name: v, shortName: s || null });
        closeSheet();
        onDone();
      },
    }, raw('L21')),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

/** Long-press menu on a Talents row (5.2 item 3). */
export function talentMenu(t, onDone) {
  const roleRows = ['main', 'maintain', 'dormant'].filter((r) => r !== t.role).map((r) => {
    const ok = roleAllowed(state, t.id, r);
    return el('button', {
      type: 'button',
      class: `btn${ok ? '' : ' off'}`,
      'aria-disabled': ok ? undefined : 'true',
      onclick: () => {
        if (!ok) return;
        closeSheet({ instant: true });
        changeRole(talentById(t.id), r, onDone);
      },
    }, ok ? raw(roleKey(r)) : `${raw(roleKey(r))} · ${text('L56', { count: slotUse(state, t.id).slots })}`);
  });
  openSheet([
    el('p', { class: 'muted' }, t.name),
    el('button', { type: 'button', class: 'btn', onclick: () => renameSheet(t, onDone) }, raw('L18')),
    ...roleRows,
    confirmDeleteButton(async () => {
      await deleteTalent(t.id);
      closeSheet();
      onDone();
    }),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

// ---- Talent page ----

export function renderTalent(root, talentId, { openChecks = false } = {}) {
  const t = talentById(talentId);
  if (!t) {
    app.back();
    return;
  }
  const L127 = raw('L127');
  const L128 = raw('L128');
  const rerender = () => app.refresh();

  const target = fmtValue(t, shownTarget(t));
  const goalStep = t.goal !== null && t.goal !== undefined && t.step
    ? text('S217', { goal: fmtValue(t, t.goal), step: fmtStep(t, t.step, dirOf(t)) })
    : null;

  // Challenge entry (same as the Today card), and the plateau note once (5.8 item 3).
  const top = [];
  const entry = challengeEntry(state, t, new Date());
  if (entry) {
    top.push(entry.ready
      ? el('button', { type: 'button', class: 'hint hint-tap', onclick: () => app.challenge(t.id) },
        el('span', { class: 'hint-lines' }, el('span', {}, entry.rank === STAR ? text('S211') : text('S144', { rank: entry.rank })), el('span', { class: 'muted small' }, text('S145'))),
        el('span', { class: 'chev muted' }, '›'))
      : el('div', { class: 'hint' }, el('span', { class: 'hint-lines' }, el('span', {}, text('S146', { rank: entry.rank === STAR ? 'S' : entry.rank })))));
  }
  if (t.plateau && t.plateau.active && !t.plateau.noteShown) {
    top.push(el('p', { class: 'muted small' }, text('S225', { step: fmtStep(t, t.step, dirOf(t)) })));
    saveTalent({ ...t, plateau: { ...t.plateau, noteShown: true } });
  }

  const practice = [
    t.needsSetup ? navRow(raw('L105'), null, () => app.setup(t.id)) : null,
    navRow(L128[0], t.focus, () => textSheet({
      title: L128[0],
      value: t.focus,
      maxlength: 80,
      onSave: async (v) => {
        await saveTalent({ ...talentById(t.id), focus: v });
        addMetric({ type: 'focusEdit', at: Date.now(), talentId: t.id });
        rerender();
      },
    })),
    t.needsSetup ? null : navRow(L128[1], null, () => app.targetStep(t.id)),
    navRow(L128[2], String((t.checks || []).length), () => checksSheet(t, rerender)),
  ];

  const records = [
    navRow(L128[3], String((t.needsWork || []).length), () => app.needsWork(t.id)),
    navRow(L128[4], String(oldTrials(t.id).length + challengeRecords(t.id).length), () => app.talentPage(t.id, 'challenges')),
    navRow(L128[5], String((t.fixed || []).length), () => app.talentPage(t.id, 'fixed')),
    oldRecordings(t.id).length ? navRow(L128[6], String(oldRecordings(t.id).length), () => app.talentPage(t.id, 'recordings')) : null,
  ];

  const schedule = slotGroups(t.id).map((slots) => {
    const days = slots.map((s) => weekdayLabel(s.weekday)).join(', ');
    const label = slots[0].anchor ? `${days} · ${slots[0].anchor}` : days;
    return navRow(label, slots[0].time, () => slotGroupSheet(slots, rerender));
  });
  schedule.push(el('button', { type: 'button', class: 'row row-tap', onclick: () => addSlotsSheet(t, rerender) },
    el('span', { class: 'row-label' }, raw('L75'))));

  // Role (spec 5.8 item 7): segments that cannot be chosen are gray and say why (L56).
  const limitNote = el('p', { class: 'muted small', hidden: true });
  const roleSeg = segmented(['main', 'maintain', 'dormant'].map((r) => ({
    value: r, label: raw(roleKey(r)), disabled: !roleAllowed(state, t.id, r),
  })), t.role, (role) => changeRole(t, role, rerender), {
    onDisabled: () => {
      limitNote.textContent = text('L56', { count: slotUse(state, t.id).slots });
      limitNote.hidden = false;
    },
  });

  // Awaken (6.18): pick Main or Maintain first.
  const awaken = t.role === 'dormant' ? el('button', {
    type: 'button',
    class: 'btn',
    onclick: () => openSheet([
      ...['main', 'maintain'].map((r) => {
        const ok = roleAllowed(state, t.id, r);
        return el('button', {
          type: 'button',
          class: `btn${ok ? '' : ' off'}`,
          onclick: () => {
            if (!ok) return;
            closeSheet({ instant: true });
            changeRole(t, r, rerender);
          },
        }, ok ? raw(roleKey(r)) : `${raw(roleKey(r))} · ${text('L56', { count: slotUse(state, t.id).slots })}`);
      }),
      el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
    ]),
  }, raw('L19')) : null;

  mount(root, el('section', { class: 'page fade-in' },
    pageTop(),
    el('div', { class: 'page-head' }, el('h1', { class: 'page-title' }, t.name), roleTag(t.role)),
    rankLadder(t.rank),
    el('div', { class: 'target-row' },
      el('div', {}, el('span', { class: 'part-label small muted' }, raw('L97')), el('span', { class: 'target-mid num' }, target || '')),
      goalStep ? el('span', { class: 'muted small num' }, goalStep) : null),
    ...top,
    group(L127[0], practice),
    group(L127[1], records),
    group(L127[2], schedule),
    el('section', { class: 'group' }, el('h2', { class: 'group-title' }, L127[3]), roleSeg.node, limitNote),
    el('div', { class: 'stack page-end' },
      el('button', { type: 'button', class: 'btn', onclick: () => renameSheet(t, rerender) }, raw('L18')),
      awaken,
      confirmDeleteButton(async () => {
        await deleteTalent(t.id);
        app.tab('talents');
      }))));
  if (openChecks) checksSheet(t, rerender);
}

// ---- Target & step (5.8.1) ----

export function renderTargetStep(root, talentId) {
  const t = talentById(talentId);
  if (!t) {
    app.back();
    return;
  }
  const L132 = raw('L132');
  const f = {
    unit: t.unit || '',
    start: t.start !== null && t.start !== undefined ? t.start : t.estimate,
    goal: t.goal,
    wholeNumbers: t.wholeNumbers !== false,
    units: null,
  };
  // Start with the current step when it fits the range.
  const r0 = stepRange(f.start, f.goal, f.wholeNumbers);
  if (r0 && !r0.equal && r0.possible && t.step) f.units = Math.round(t.step / r0.unit);
  const unit = textInput(f.unit, { maxlength: 20, autocapitalize: 'none' });
  const start = numberInput(f.start === null ? '' : f.start);
  const goal = numberInput(f.goal === null ? '' : f.goal);
  const save = el('button', { type: 'button', class: 'btn-text save-top' }, raw('L21'));
  const values = (step) => computeRankValues({
    start: roundValue(f.wholeNumbers, f.start), goal: roundValue(f.wholeNumbers, f.goal), step, wholeNumbers: f.wholeNumbers,
  });
  const block = stepBlock({
    get: () => ({
      now: f.start, goal: f.goal, wholeNumbers: f.wholeNumbers, unit: f.unit, units: f.units,
    }),
    onUnits: (u) => { f.units = u; },
    result: (step, n, tt) => {
      const v = values(step);
      const fv = (x) => fmtValue(tt, x);
      return [
        el('p', { class: 'num' }, text('S221', { n })),
        el('p', { class: 'muted small' }, text('S222')),
        el('p', { class: 'muted small num' }, text('S223', {
          e: fv(v.E), d: fv(v.D), c: fv(v.C), b: fv(v.B), a: fv(v.A), s: fv(v.S),
        })),
      ];
    },
  });
  const paint = () => {
    block.paint();
    save.disabled = !block.ok();
  };
  unit.addEventListener('input', () => { f.unit = unit.value.trim(); paint(); });
  start.addEventListener('input', () => { f.start = parseNumber(start.value); f.units = null; paint(); });
  goal.addEventListener('input', () => { f.goal = parseNumber(goal.value); f.units = null; paint(); });
  block.node.addEventListener('input', () => { save.disabled = !block.ok(); });
  const whole = toggle(f.wholeNumbers, (on) => { f.wholeNumbers = on; f.units = null; paint(); }, raw('L138'));
  save.addEventListener('click', async () => {
    if (save.disabled) return;
    save.disabled = true;
    const step = stepFor(stepRange(f.start, f.goal, f.wholeNumbers), f.units);
    const cur = talentById(t.id);
    const s = roundValue(f.wholeNumbers, f.start);
    const g = roundValue(f.wholeNumbers, f.goal);
    const dir = g >= s ? 1 : -1;
    let target = cur.target;
    if (target !== null && target !== undefined) {
      // Not worse than the new start, not past the new goal (5.8.1).
      target = roundValue(f.wholeNumbers, target);
      if (dir * (target - s) < 0) target = s;
      if (dir * (target - g) > 0) target = g;
    }
    const measured = cur.start !== null && cur.start !== undefined;
    await saveTalent({
      ...cur,
      unit: f.unit,
      wholeNumbers: f.wholeNumbers,
      start: measured ? s : null,
      estimate: measured ? cur.estimate : s,
      goal: g,
      step,
      target: measured ? target : cur.target,
      rankValues: measured ? values(step) : cur.rankValues,
    });
    addMetric({ type: 'stepEdit', at: Date.now(), talentId: t.id });
    app.back();
  });
  paint();
  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top page-top-split' }, backButton(() => app.back()), save),
    el('h1', { class: 'page-title' }, raw('L128')[1]),
    el('div', { class: 'triple' }, field(L132[0], unit), field(L132[1], start), field(L132[2], goal)),
    el('label', { class: 'row row-plain' }, el('span', { class: 'row-label' }, raw('L138')), whole),
    block.node));
}

/** Checks: 3 text boxes and Save (spec 5.8 item 4). */
function checksSheet(t, onSaved) {
  const current = (t.checks || []).slice();
  const inputs = [0, 1, 2].map((i) => textInput(current[i] || '', { maxlength: 80 }));
  openSheet([
    el('h2', { class: 'sheet-title' }, raw('L128')[2]),
    ...inputs,
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: async () => {
        const checks = inputs.map((i) => i.value.trim()).filter(Boolean);
        await saveTalent({ ...talentById(t.id), checks });
        closeSheet();
        onSaved();
      },
    }, raw('L21')),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);
}

// ---- Needs work (5.8.2) ----

export function renderNeedsWork(root, talentId) {
  const t = talentById(talentId);
  if (!t) {
    app.back();
    return;
  }
  const rerender = () => app.refresh();
  const save = (patch) => saveTalent({ ...talentById(t.id), ...patch });
  const list = (t.needsWork || []).slice().sort((a, b) => a.createdAt - b.createdAt);

  const rename = (item) => textSheet({
    title: raw('L18'),
    value: item.text,
    onSave: async (v) => {
      await save({ needsWork: talentById(t.id).needsWork.map((x) => (x.id === item.id ? { ...x, text: v } : x)) });
      rerender();
    },
  });
  const remove = async (item) => {
    await save({ needsWork: talentById(t.id).needsWork.filter((x) => x.id !== item.id) });
    rerender();
  };
  const options = (item) => openSheet([
    el('p', { class: 'muted' }, item.text),
    el('button', { type: 'button', class: 'btn', onclick: () => rename(item) }, raw('L18')),
    el('button', { type: 'button', class: 'btn', onclick: () => { closeSheet(); remove(item); } }, raw('L16')),
    el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
  ]);

  const rows = list.map((item) => {
    const fixedBtn = el('button', { type: 'button', class: 'btn-small' }, raw('L129'));
    const content = el('div', { class: 'row' }, el('span', { class: 'row-label' }, item.text), fixedBtn);
    const sw = swipeRow(content, [
      { label: raw('L18'), onClick: () => { sw.close(); rename(item); } },
      { label: raw('L16'), onClick: () => remove(item) },
    ]);
    fixedBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Slides out to the right; the rows below move up (spec 3.3).
      sw.node.classList.add('slide-out');
      const cur = talentById(t.id);
      await save({
        needsWork: cur.needsWork.filter((x) => x.id !== item.id),
        fixed: [...(cur.fixed || []), { text: item.text, createdAt: item.createdAt, fixedAt: dateKey(new Date()) }],
      });
      setTimeout(rerender, 200);
    });
    onLongPress(content, () => options(item));
    return sw.node;
  });
  rows.push(el('button', {
    type: 'button',
    class: 'row row-tap',
    onclick: () => textSheet({
      title: raw('L99'),
      onSave: async (v) => {
        const cur = talentById(t.id);
        await save({ needsWork: [...(cur.needsWork || []), { id: newId(), text: v, createdAt: Date.now() }] });
        rerender();
      },
    }),
  }, el('span', { class: 'row-label' }, raw('L130'))));

  mount(root, el('section', { class: 'page fade-in' },
    pageTop(),
    el('h1', { class: 'page-title' }, raw('L99')),
    el('p', { class: 'muted small' }, text('S218')),
    el('section', { class: 'group' }, el('div', { class: 'group-card' }, rows)),
    el('p', { class: 'muted small' }, text('S219'))));
}

// ---- Challenges, Fixed, Old recordings (5.8.3, 4.8) ----

export function renderTalentPage(root, talentId, which) {
  const t = talentById(talentId);
  if (!t) {
    app.back();
    return;
  }
  const L128 = raw('L128');
  const rerender = () => app.refresh();
  let title;
  let body;
  if (which === 'challenges') {
    title = L128[4];
    const resultWord = (r) => raw(r.result === 'passed' ? 'L111' : 'L112');
    const items = [
      ...oldTrials(t.id).map((r) => ({ at: r.at || 0, line: text('S283', { date: fmtDateKey(r.date), value: fmtValue(t, r.value) }) })),
      ...challengeRecords(t.id).map((r) => ({
        at: r.at,
        line: r.kind === 'checkpoint'
          ? text('S220', { date: monthDay(new Date(r.at)), rank: null, value: fmtValue(t, r.value), result: resultWord(r) }).replace(/^([^·]*· )/, `$1${raw('L131')} · `)
          : text('S220', {
            date: monthDay(new Date(r.at)), rank: r.star ? 'S ★' : r.challengeRank, value: fmtValue(t, r.value), result: resultWord(r),
          }),
      })),
    ];
    const rows = items.sort((a, b) => b.at - a.at).map((x) => el('div', { class: 'row' }, el('span', { class: 'row-label num' }, x.line)));
    body = [el('section', { class: 'group' }, rows.length ? el('div', { class: 'group-card' }, rows) : null)];
  } else if (which === 'fixed') {
    title = L128[5];
    const rows = (t.fixed || []).map((f, i) => {
      const row = el('div', { class: 'row' }, el('span', { class: 'row-label' }, f.text), el('span', { class: 'row-value muted small num' }, fmtDateKey(f.fixedAt)));
      onLongPress(row, () => openSheet([
        el('p', { class: 'muted' }, f.text),
        confirmDeleteButton(async () => {
          const cur = talentById(t.id);
          await saveTalent({ ...cur, fixed: (cur.fixed || []).filter((x, j) => j !== i) });
          closeSheet();
          rerender();
        }),
        el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => closeSheet() }, raw('L03')),
      ]));
      return row;
    }).reverse();
    body = [el('section', { class: 'group' }, rows.length ? el('div', { class: 'group-card' }, rows) : null)];
  } else {
    title = L128[6];
    const rows = oldRecordings(t.id).slice().reverse().map((m) => el('div', { class: 'row row-media' },
      el('span', { class: 'row-label small muted num' }, monthDay(new Date(m.createdAt))),
      mediaNode(m),
      confirmDeleteButton(async () => {
        await deleteMedia(m.id);
        rerender();
      }, 'btn-small')));
    body = [el('p', { class: 'muted small' }, text('S224')), el('section', { class: 'group' }, rows.length ? el('div', { class: 'group-card' }, rows) : null)];
  }
  mount(root, el('section', { class: 'page fade-in' }, pageTop(), el('h1', { class: 'page-title' }, title), ...body));
}

/** An old recording: audio with the system player, a photo, or text. */
function mediaNode(m) {
  if (m.media === 'text') return el('p', { class: 'media-text' }, m.text || '');
  if (!m.blob) return null;
  const url = URL.createObjectURL(m.blob);
  if (m.media === 'photo') return el('img', { class: 'media-photo', alt: '', src: url });
  return el('audio', { controls: true, preload: 'none', src: url });
}
