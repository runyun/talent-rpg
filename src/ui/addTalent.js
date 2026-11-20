// Add a talent (spec 5.6). One scrolling form; Save at the bottom.
// The baseline test (step 7) comes with recording in stage 3.

import { el } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import { DAY, dateKey, weekKey } from '../time.js';
import {
  state, newId, addTalent as storeAddTalent, addMetric,
} from '../store.js';
import { defaultN, newAttribute, startValues } from '../model/knobs.js';
import { instancesForWeek } from '../model/schedule.js';
import {
  segmented, timePicker, field, textInput, numberInput,
} from './widgets.js';

const LEVELS = ['beginner', 'basic', 'intermediate'];
const METRICS = ['speed', 'mistakes', 'lengthOrCount', 'time'];
const PLACES = ['home', 'commute', 'work', 'custom'];

export function roleLimits(now = Date.now()) {
  const early = now - state.player.firstOpenedAt < CONFIG.roles.earlyWeeks * 7 * DAY;
  return { main: CONFIG.roles.mainMax, maintain: early ? CONFIG.roles.maintainMaxEarly : CONFIG.roles.maintainMax };
}

export function roleOptions(excludeTalentId = null) {
  const limits = roleLimits();
  const count = (role) => state.talents.filter((t) => t.role === role && t.id !== excludeTalentId).length;
  return [
    { value: 'main', label: raw('L45'), disabled: count('main') >= limits.main, note: text('L56', { count: limits.main }) },
    { value: 'maintain', label: raw('L46'), disabled: count('maintain') >= limits.maintain, note: text('L56', { count: limits.maintain }) },
    { value: 'dormant', label: raw('L47') },
  ];
}

export function placeOptions() {
  return PLACES.map((p, i) => ({ value: p, label: raw('L53')[i] }));
}

export function lengthOptions() {
  return [15, 45].map((m) => ({ value: m, label: text('L43', { min: m }) }));
}

export function weekdayOptions() {
  return [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: raw('L55')[d + 1] }));
}

/** renderAddTalent({ onboarding, onDone(talent), onCancel }) */
export function renderAddTalent({ onboarding, onDone, onCancel }) {
  const openedAt = Date.now();
  const L61 = raw('L61');
  const L62 = raw('L62');
  const L49 = raw('L49');

  let level = 'beginner';

  // Name
  const nameInput = textInput('', { maxlength: 60 });

  // Level
  const levelSeg = segmented(LEVELS.map((v, i) => ({ value: v, label: raw('L50')[i] })), level, (v) => {
    level = v;
    refreshDefaults();
  });

  // Attributes
  const attrRows = L49.map((label, index) => {
    const material = textInput('', { maxlength: 120 });
    const n = numberInput(defaultN(index, level).n);
    let nEdited = false;
    n.addEventListener('input', () => { nEdited = true; });
    const unit = index === 1 ? el('span', { class: 'muted' }, raw('L71')) : null;
    const row = { index, material, n, isEdited: () => nEdited };
    const children = [
      el('div', { class: 'attr-head' }, el('span', {}, label)),
      material,
      el('div', { class: 'inline' }, n, unit),
    ];
    if (index === 0) {
      row.speed = numberInput('', { placeholder: String(startValues(level).bpm) });
      row.speedUnitText = textInput('', { maxlength: 20, hidden: true });
      row.speedUnit = segmented(raw('L52').map((l, i) => ({ value: i === 0 ? 'bpm' : 'custom', label: l })), 'bpm', (v) => {
        row.speedUnitText.hidden = v !== 'custom';
        row.speed.placeholder = v === 'bpm' ? String(startValues(level).bpm) : '';
      });
      children.push(field(L61[3], el('div', { class: 'inline' }, row.speed), row.speedUnit.node, row.speedUnitText));
    }
    row.node = el('div', { class: 'attr-row' }, ...children);
    return row;
  });

  function refreshDefaults() {
    for (const row of attrRows) {
      if (!row.isEdited()) row.n.value = defaultN(row.index, level).n;
      if (row.speed && row.speedUnit.value === 'bpm') row.speed.placeholder = String(startValues(level).bpm);
    }
  }

  // Trial piece
  const pieceInput = textInput('', { maxlength: 80 });
  const metricSeg = segmented(METRICS.map((v, i) => ({ value: v, label: raw('L51')[i] })), 'speed');
  const metricUnit = textInput('', { maxlength: 20 });

  // Role
  const roles = roleOptions();
  const defaultRole = (roles.find((r) => !r.disabled) || roles[2]).value;
  const roleSeg = segmented(roles, defaultRole);
  const roleNotes = el('p', { class: 'muted small' }, roles.filter((r) => r.disabled).map((r) => `${r.label}: ${r.note}`).join(' · '));

  // Slots
  const lastSlot = state.slots[state.slots.length - 1];
  const warn = el('p', { class: 'muted small', hidden: true }, text('S52'));
  const daysSeg = segmented(weekdayOptions(), [], updateWarn, { multi: true });
  const anchorInput = textInput('', { maxlength: 40 });
  const time = timePicker(lastSlot ? lastSlot.time : '20:00');
  const lengthSeg = segmented(lengthOptions(), 15);
  const placeText = textInput('', { maxlength: 40, hidden: true });
  const placeSeg = segmented(placeOptions(), 'home', (v) => { placeText.hidden = v !== 'custom'; });

  function updateWarn(days) {
    const early = Date.now() - state.player.firstOpenedAt < CONFIG.slots.warnWeeks * 7 * DAY;
    const existing = instancesForWeek(weekKey(new Date()), { ...state, sessions: [] }).length;
    warn.hidden = !(early && existing + days.length > CONFIG.slots.weeklyWarnLimit);
  }

  const save = el('button', { type: 'button', class: 'btn btn-primary' }, raw('L21'));
  save.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const hasMaterial = attrRows.some((r) => r.material.value.trim());
    if (!name || !hasMaterial) {
      (name ? attrRows[0].material : nameInput).focus();
      return;
    }
    save.disabled = true;
    const now = Date.now();
    const talent = {
      id: newId(),
      name,
      startLevel: level,
      role: roleSeg.value,
      roleSince: dateKey(new Date(now)),
      rank: 'E',
      stars: 0,
      passesInRank: 0,
      trialWork: pieceInput.value.trim(),
      trialMetric: metricSeg.value,
      trialMetricUnit: metricUnit.value.trim(),
      nextTrialDue: null,
      retryAvailableAt: null,
      baselineDone: false,
      reachedCAt: null,
      createdAt: now,
      cycleStart: dateKey(new Date(now)),
      retryPending: false,
      failStreak: 0,
      baselineNeeded: false,
    };
    const attributes = attrRows.map((r) => newAttribute(talent.id, r.index, level, {
      material: r.material.value,
      n: r.n.value,
      speed: r.speed ? r.speed.value : null,
      speedUnit: r.speed ? r.speedUnit.value : null,
      speedUnitText: r.speed ? r.speedUnitText.value : '',
    }));
    const slots = talent.role === 'dormant' ? [] : daysSeg.value.sort().map((weekday) => ({
      id: newId(),
      talentId: talent.id,
      weekday,
      anchor: anchorInput.value.trim(),
      time: time.value,
      length: lengthSeg.value,
      place: placeSeg.value,
      placeText: placeSeg.value === 'custom' ? placeText.value.trim() : '',
      overrides: {},
      createdAt: now,
    }));
    await storeAddTalent(talent, attributes, slots);
    addMetric({ type: 'addTalent', at: now, seconds: Math.round((now - openedAt) / 1000) });
    onDone(talent);
  });

  const cancel = onboarding ? null : el('button', { type: 'button', class: 'btn-text', onclick: onCancel }, raw('L03'));

  return el('section', { class: 'form fade-in' },
    el('div', { class: 'form-top' }, cancel, el('span', { class: 'section-title' }, raw('L20'))),
    field(L61[0], nameInput),
    field(L61[1], levelSeg.node),
    el('div', { class: 'field' }, el('span', { class: 'field-label' }, L61[2]), ...attrRows.map((r) => r.node)),
    field(L61[4], pieceInput),
    field(L61[5], metricSeg.node),
    field(L61[6], metricUnit),
    field(L61[7], roleSeg.node, roleNotes),
    el('div', { class: 'field' },
      el('span', { class: 'field-label' }, L61[8]),
      field(L62[0], daysSeg.node),
      field(L62[1], anchorInput),
      field(L62[2], time.node),
      field(L62[3], lengthSeg.node),
      field(L62[4], placeSeg.node, placeText),
      warn),
    el('div', { class: 'form-bottom' }, save),
  );
}
