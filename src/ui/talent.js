// Talent page (spec 5.8, stage 2 part): attributes with material history and knobs
// (long press to edit), and the slot list (tap to edit or delete).
// Trial history, role switch and Awaken come in stage 3.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { weekdayLabel } from '../time.js';
import {
  talentById, attrsOf, slotsOf, saveAttribute, addMetric,
} from '../store.js';
import {
  formatN, formatSpeed, knobProgress, positiveInt, positiveNum,
} from '../model/knobs.js';
import {
  onLongPress, backButton, bar, openSheet, closeSheet, field, textInput, numberInput, segmented,
} from './widgets.js';
import { slotEditSheet } from './sheets.js';
import { rankText } from './home.js';
import { app } from './app.js';

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function roleLabel(role) {
  return raw({ main: 'L45', maintain: 'L46', dormant: 'L47' }[role]);
}

function placeLabel(slot) {
  if (slot.place === 'custom') return slot.placeText || raw('L53')[3];
  return raw('L53')[['home', 'commute', 'work'].indexOf(slot.place)];
}

export function renderTalent(root, talentId) {
  const talent = talentById(talentId);
  if (!talent) {
    app.home();
    return;
  }
  const L63 = raw('L63');
  const rerender = () => renderTalent(root, talentId);

  const attrBlocks = attrsOf(talentId).map((a) => {
    const values = [
      el('span', { class: 'num' }, `${formatN(a)} | ${L63[1]} ${formatN(a, a.nTarget)}`),
    ];
    if (a.speedStart) values.push(el('span', { class: 'num' }, `${formatSpeed(a)} | ${L63[1]} ${formatSpeed(a, a.speedTarget)}`));
    const history = (a.materialHistory || []).map((h) => el('li', { class: 'muted small' },
      `${h.material} · ${monthDay.format(new Date(h.reachedAt))}`));
    const block = el('div', { class: 'attr-block' },
      el('div', { class: 'talent-head' }, el('span', {}, a.name)),
      el('p', {}, a.material || '—'),
      bar(knobProgress(a)),
      el('div', { class: 'values muted small' }, values),
      history.length ? el('div', {}, el('span', { class: 'muted small' }, L63[0]), el('ul', { class: 'history' }, history)) : null);
    onLongPress(block, () => attributeSheet(a, rerender));
    return block;
  });

  const slotRows = slotsOf(talentId)
    .sort((x, y) => x.weekday - y.weekday || x.time.localeCompare(y.time))
    .map((s) => el('button', {
      type: 'button',
      class: 'list-row',
      onclick: () => slotEditSheet(s, rerender),
    },
    el('span', { class: 'num' }, `${weekdayLabel(s.weekday)} ${s.time}`),
    el('span', { class: 'muted small' }, [s.anchor, text('L43', { min: s.length }), placeLabel(s)].filter(Boolean).join(' · '))));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.home())),
    el('h1', { class: 'page-title' }, talent.name),
    el('p', { class: 'muted small' }, `${roleLabel(talent.role)} · ${rankText(talent)}`),
    el('div', { class: 'section' }, ...attrBlocks),
    el('div', { class: 'section' },
      el('h2', { class: 'section-title' }, L63[2]),
      ...slotRows)));
}

/** Long press on an attribute: edit name, material, N, speed and targets (spec 6.6). */
function attributeSheet(a, onSaved) {
  const name = textInput(a.name, { maxlength: 40 });
  const material = textInput(a.material, { maxlength: 120 });
  const nCur = numberInput(a.nCurrent);
  const nTarget = numberInput(a.nTarget);
  const target = raw('L63')[1];
  const nodes = [
    field(raw('L61')[0], name),
    field(raw('L61')[2], material),
    field(raw('L51')[2], el('div', { class: 'inline' }, nCur, a.nUnit === 'sec' ? el('span', { class: 'muted' }, raw('L71')) : null)),
    field(target, nTarget),
  ];

  let speed = null;
  let speedTarget = null;
  let speedUnit = null;
  let speedUnitText = null;
  if (a.index === 0) {
    speed = numberInput(a.speedCurrent ?? '');
    speedTarget = numberInput(a.speedTarget ?? '');
    speedUnitText = textInput(a.speedUnitText || '', { maxlength: 20, hidden: a.speedUnit !== 'custom' });
    speedUnit = segmented(raw('L52').map((l, i) => ({ value: i === 0 ? 'bpm' : 'custom', label: l })), a.speedUnit || 'bpm', (v) => {
      speedUnitText.hidden = v !== 'custom';
    });
    nodes.push(field(raw('L61')[3], speed, speedUnit.node, speedUnitText), field(target, speedTarget));
  }

  const save = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    onclick: async () => {
      const now = Date.now();
      const next = {
        ...a,
        name: name.value.trim() || a.name,
        material: material.value.trim(),
        nCurrent: positiveInt(nCur.value) || a.nCurrent,
        nTarget: positiveInt(nTarget.value) || a.nTarget,
        targetPromptOff: false, // asking about a cleared material starts again (spec 6.6)
      };
      if (next.nCurrent !== a.nCurrent) next.knobLastChangedAt = now;
      if (speed) {
        const v = positiveNum(speed.value);
        if (!v) {
          Object.assign(next, { speedStart: null, speedCurrent: null, speedTarget: null, speedUnit: null, speedUnitText: '' });
        } else {
          Object.assign(next, {
            speedStart: a.speedStart || v,
            speedCurrent: v,
            speedTarget: positiveNum(speedTarget.value) || a.speedTarget || Math.round(v * 2),
            speedUnit: speedUnit.value,
            speedUnitText: speedUnit.value === 'custom' ? speedUnitText.value.trim() : '',
          });
          if (v !== a.speedCurrent) next.knobLastChangedAt = now;
        }
      }
      await saveAttribute(next);
      if (next.material !== a.material) addMetric({ type: 'materialEdit', at: now });
      closeSheet();
      onSaved();
    },
  }, raw('L21'));

  openSheet(el('div', { class: 'stack' }, ...nodes, save,
    el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03'))));
}
