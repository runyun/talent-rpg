// Talent page (spec 5.8, stage 2 part): attributes with material history and knobs
// (long press to edit), the slot list (add, tap to edit or delete), trial history,
// role switch and Awaken.

import { el, mount, svg } from '../dom.js';
import { text, raw } from '../text.js';
import { weekdayLabel, fromDateKey } from '../time.js';
import {
  state, talentById, attrsOf, slotsOf, saveAttribute, addMetric, mediaById,
} from '../store.js';
import { formatValue } from '../model/trials.js';
import { mediaView } from './media.js';
import {
  formatN, formatSpeed, knobProgress, positiveInt, positiveNum,
} from '../model/knobs.js';
import {
  onLongPress, backButton, bar, openSheet, closeSheet, field, textInput, numberInput, segmented,
} from './widgets.js';
import { slotEditSheet, newSlotsSheet, roleButtons } from './sheets.js';
import { rankText } from './home.js';
import { app } from './app.js';

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function roleLabel(role) {
  return raw({ main: 'L45', maintain: 'L46', dormant: 'L47' }[role]);
}

export function renderTalent(root, talentId) {
  const talent = talentById(talentId);
  if (!talent) {
    app.home();
    return;
  }
  const L63 = raw('L63');
  const rerender = () => app.refresh();

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
    el('span', { class: 'muted small' }, [s.anchor, text('L43', { min: s.length })].filter(Boolean).join(' · '))));

  // Role switch; Awaken (L19) for a dormant talent.
  const roleNode = talent.role === 'dormant'
    ? el('button', {
      type: 'button',
      class: 'btn',
      onclick: () => openSheet(el('div', { class: 'stack' },
        ...roleButtons(talent, rerender).slice(0, 2),
        el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03')))),
    }, raw('L19'))
    : el('div', { class: 'seg' }, roleButtons(talent, rerender));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('h1', { class: 'page-title' }, talent.name),
    el('p', { class: 'muted small' }, `${roleLabel(talent.role)} · ${rankText(talent)}`),
    roleNode,
    el('div', { class: 'section' }, ...attrBlocks),
    el('div', { class: 'section' },
      el('h2', { class: 'section-title' }, L63[2]),
      ...slotRows,
      el('button', { type: 'button', class: 'btn-text', onclick: () => newSlotsSheet(talent, rerender) }, raw('L75'))),
    trialHistory(talent),
    renderArchive(talent)));
}

/** Trial history: values as a line, then each record with its recordings (spec 5.8). */
function trialHistory(talent) {
  const records = state.trials.filter((t) => t.talentId === talent.id && t.value !== null && t.value !== undefined);
  if (!records.length) return null;
  const values = records.map((r) => Number(r.value));
  const w = 300;
  const h = 80;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i) => (records.length === 1 ? w / 2 : 8 + (i * (w - 16)) / (records.length - 1));
  const y = (v) => (max === min ? h / 2 : h - 8 - ((v - min) * (h - 16)) / (max - min));
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const dots = values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"/>`).join('');
  const chart = svg(`<polyline points="${points}"/>${dots}`, `0 0 ${w} ${h}`);
  chart.classList.add('trial-chart');

  return el('div', { class: 'section' },
    el('h2', { class: 'section-title' }, raw('L63')[3]),
    chart);
}

// ---- Progress archive (spec 5.8): trial recordings by time, then 30-sec records; pick two ----

let archivePicks = [];

function renderArchive(talent) {
  const L64 = raw('L64');
  const pickable = (record, label) => {
    const picked = archivePicks.includes(record.id);
    const pick = el('button', {
      type: 'button',
      class: `seg-btn small${picked ? ' on' : ''}`,
      'aria-pressed': picked ? 'true' : 'false',
      onclick: () => {
        archivePicks = picked ? archivePicks.filter((x) => x !== record.id) : [...archivePicks.slice(-1), record.id];
        app.refresh();
      },
    }, label);
    return el('div', { class: 'archive-item' }, pick, mediaView(record));
  };

  const trialItems = [];
  const trials = state.trials
    .filter((x) => x.talentId === talent.id)
    .sort((a, b) => (a.at || 0) - (b.at || 0) || a.date.localeCompare(b.date));
  for (const tr of trials) {
    const date = monthDay.format(fromDateKey(tr.date));
    const measured = mediaById(tr.recordingId);
    if (measured) trialItems.push(pickable(measured, [date, formatValue(talent, tr.value)].filter(Boolean).join(' · ')));
    const full = mediaById(tr.fullRecordingId);
    if (full) trialItems.push(pickable(full, `${date} · ${tr.piece || talent.trialWork}`));
  }
  const evidence = state.media
    .filter((m) => m.talentId === talent.id && m.type === 'evidence30s')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => pickable(m, monthDay.format(fromDateKey(m.date))));
  if (!trialItems.length && !evidence.length) return null;

  // Two picked records side by side.
  const mine = new Set(state.media.filter((m) => m.talentId === talent.id).map((m) => m.id));
  archivePicks = archivePicks.filter((id) => mine.has(id));
  const picked = archivePicks.map(mediaById).filter(Boolean);
  const compare = picked.length === 2
    ? el('div', { class: 'compare frame' }, picked.map((m) => mediaView(m, { label: monthDay.format(fromDateKey(m.date)) })))
    : el('p', { class: 'muted small' }, L64[2]);

  return el('div', { class: 'section' },
    compare,
    trialItems.length ? el('h2', { class: 'section-title' }, L64[0]) : null,
    ...trialItems,
    evidence.length ? el('h2', { class: 'section-title' }, L64[1]) : null,
    ...evidence);
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
    field(raw('L85'), material),
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
