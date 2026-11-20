// Trial screens (spec 5.5, 7.1-7.3), baseline (S08) and awaken retest (S35/S36).
// kind: 'trial' | 'retry' | 'baseline' | 'awaken'
// Steps: [warm-up 5 min] -> measured run 2 min (record) -> value -> [compare + "better?"] -> [full piece] -> result

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import { MINUTE, dateKey, fromDateKey } from '../time.js';
import {
  state, attrsOf, talentById, newId, saveTrial, applyUpdates, mediaById,
} from '../store.js';
import {
  applyResult, formatValue, gap, meetsTarget, metricName, nextDue, passTarget, previousRecord, rankIndex, METRICS,
} from '../model/trials.js';
import { orderAttributes } from '../model/card.js';
import { replaceMaterial } from '../model/knobs.js';
import { awakenAttributes, roleChange } from '../model/roles.js';
import { keepAwake, releaseAwake } from '../wakelock.js';
import { captureControls, mediaView, stopPlaying } from './media.js';
import { fmtClock } from './timer.js';
import {
  field, textInput, numberInput, segmented, openSheet, closeSheet,
} from './widgets.js';
import { app } from './app.js';

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const shortDate = (key) => monthDay.format(fromDateKey(key));

let tick = null;

function stopClock() {
  clearInterval(tick);
  tick = null;
  releaseAwake();
}

export function leaveTrial() {
  stopClock();
  stopPlaying();
}

/** renderTrial(root, { talentId, kind, role }) — role is the new role for 'awaken'. */
export function renderTrial(root, { talentId, kind, role }) {
  const talent = talentById(talentId);
  if (!talent) {
    app.home();
    return;
  }
  const ctx = {
    root, talent, kind, role, value: null, measured: null, full: null, felt: null,
  };
  if (kind === 'trial' || kind === 'retry') warmUp(ctx);
  else measuredRun(ctx);
}

function screen(ctx, ...children) {
  const cancel = el('button', {
    type: 'button',
    class: 'btn-text small timer-cancel',
    onclick: () => {
      leaveTrial();
      app.home();
    },
  }, raw('L03'));
  mount(ctx.root, el('section', { class: 'timer fade-in' }, el('div', { class: 'timer-top' }, cancel), ...children));
}

/** Countdown that calls onEnd once. */
function countdown(clock, minutes, onEnd) {
  stopClock();
  const endsAt = Date.now() + minutes * MINUTE;
  const update = () => {
    const left = endsAt - Date.now();
    clock.textContent = fmtClock(left);
    if (left <= 0) {
      stopClock();
      onEnd();
    }
  };
  update();
  tick = setInterval(update, 250);
  keepAwake();
}

// ---- 1. Warm-up ----

function warmUp(ctx) {
  const practiced = orderAttributes(attrsOf(ctx.talent.id));
  const last = practiced.filter((a) => a.lastPracticedAt).pop() || practiced[0];
  const clock = el('p', { class: 'timer-clock num' });
  const next = () => measuredRun(ctx);
  screen(ctx,
    el('p', { class: 'timer-task' }, text('S21', { material: last && last.material })),
    clock,
    el('div', { class: 'focus-bottom' },
      el('button', { type: 'button', class: 'btn', onclick: () => { stopClock(); next(); } }, raw('L15'))));
  countdown(clock, CONFIG.trial.warmUpMin, next);
}

// ---- 2. Measured run ----

function measuredRun(ctx) {
  const { talent, kind } = ctx;
  const prev = previousRecord(talent.id, state.trials);
  const heading = [];
  if (kind === 'baseline') heading.push(el('p', { class: 'line1' }, text('S08', { talent: talent.name, piece: talent.trialWork })));
  if (kind === 'awaken') heading.push(el('p', { class: 'line1' }, text('S35', { talent: talent.name, rank: talent.rank })));
  if ((kind === 'trial' || kind === 'retry') && talent.trialMetric === 'mistakes' && prev && Number(prev.value) === 0) {
    heading.push(el('p', { class: 'small' }, text('S56')));
  }

  const clock = el('p', { class: 'timer-clock num' }, fmtClock(CONFIG.trial.measuredRunMin * MINUTE));
  const preview = el('div', {});
  const valueBox = el('div', { class: 'stack', hidden: true });
  let started = false;

  const showValue = () => {
    if (!valueBox.hidden) return;
    valueBox.hidden = false;
    const L51 = raw('L51');
    const input = numberInput('');
    const unit = talent.trialMetricUnit ? el('span', { class: 'muted' }, talent.trialMetricUnit) : null;
    const save = el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: () => {
        if (input.value.trim() === '' || !Number.isFinite(Number(input.value))) {
          input.focus();
          return;
        }
        ctx.value = Number(input.value);
        capture.stop();
        stopClock();
        afterValue(ctx);
      },
    }, raw('L21'));
    valueBox.append(field(L51[METRICS.indexOf(talent.trialMetric)] || L51[0], el('div', { class: 'inline' }, input, unit)), save);
  };

  const capture = captureControls({
    talentId: talent.id,
    type: 'trialMeasured',
    onCaptured: (record) => {
      ctx.measured = record;
      preview.replaceChildren(mediaView(record));
      showValue();
    },
    onRecordingChange: (on) => {
      if (on && !started) {
        started = true;
        countdown(clock, CONFIG.trial.measuredRunMin, () => {
          capture.stop();
          showValue();
        });
      }
    },
  });

  screen(ctx,
    ...heading,
    el('p', { class: 'timer-task' }, text('S22', { metric: metricName(talent.trialMetric) })),
    clock,
    capture.node,
    preview,
    valueBox);
}

// ---- 3. Compare ----

function afterValue(ctx) {
  const { talent, kind } = ctx;
  if (kind === 'baseline') {
    saveBaseline(ctx);
    return;
  }
  if (kind === 'awaken') {
    saveAwaken(ctx);
    return;
  }
  const prev = previousRecord(talent.id, state.trials);
  if (!prev) {
    // No starting point yet: this run becomes the baseline.
    saveBaseline(ctx);
    return;
  }
  ctx.prev = prev;
  ctx.target = passTarget(talent, prev.value);
  const prevMedia = mediaById(prev.recordingId);
  screen(ctx,
    el('p', { class: 'timer-task num pre' }, text('S23', {
      value: formatValue(talent, ctx.value), prev: formatValue(talent, prev.value), target: formatValue(talent, ctx.target),
    })),
    el('div', { class: 'compare' },
      mediaView(prevMedia, { label: shortDate(prev.date) }),
      mediaView(ctx.measured, { label: shortDate(dateKey(new Date())) })),
    el('p', {}, text('S24')),
    el('div', { class: 'focus-bottom' },
      el('button', { type: 'button', class: 'btn btn-big', onclick: () => { ctx.felt = true; fullPiece(ctx); } }, raw('L12')),
      el('button', { type: 'button', class: 'btn btn-big', onclick: () => { ctx.felt = false; fullPiece(ctx); } }, raw('L13'))));
}

// ---- 4. Optional full piece ----

function fullPiece(ctx) {
  stopPlaying();
  const preview = el('div', {});
  const save = el('button', { type: 'button', class: 'btn btn-primary', hidden: true, onclick: () => finishTrial(ctx) }, raw('L21'));
  const capture = captureControls({
    talentId: ctx.talent.id,
    type: 'trialFull',
    onCaptured: (record) => {
      ctx.full = record;
      preview.replaceChildren(mediaView(record));
      save.hidden = false;
    },
  });
  screen(ctx,
    el('p', { class: 'timer-task' }, raw('L28')),
    capture.node,
    preview,
    el('div', { class: 'focus-bottom' },
      save,
      el('button', { type: 'button', class: 'btn', onclick: () => { capture.stop(); ctx.full = null; finishTrial(ctx); } }, raw('L15'))));
}

// ---- 5. Result ----

function trialRecord(ctx, kind, passed) {
  const now = Date.now();
  return {
    id: newId(),
    talentId: ctx.talent.id,
    date: dateKey(new Date(now)),
    at: now,
    kind,
    value: ctx.value,
    recordingId: ctx.measured ? ctx.measured.id : null,
    fullRecordingId: ctx.full ? ctx.full.id : null,
    felt: ctx.felt,
    passed,
    piece: ctx.talent.trialWork,
    metric: ctx.talent.trialMetric,
  };
}

const mediaOf = (ctx) => [ctx.measured, ctx.full].filter(Boolean);

async function finishTrial(ctx) {
  leaveTrial();
  const { talent, kind } = ctx;
  const improved = meetsTarget(talent, ctx.value, ctx.target);
  const passed = improved && ctx.felt === true;
  const now = new Date();
  const result = applyResult(talent, { kind, passed, now });
  await saveTrial({ trial: trialRecord(ctx, kind, passed), talent: result.talent, media: mediaOf(ctx) });
  const t = result.talent;

  const lines = [];
  if (passed && result.star) lines.push(text('S28', { talent: t.name, count: t.stars }));
  else if (passed && result.rankUp) {
    lines.push(text('S25', {
      talent: t.name, rank: t.rank, metric: metricName(t.trialMetric), old: formatValue(t, ctx.prev.value), new: formatValue(t, ctx.value),
    }));
  } else if (passed) {
    lines.push(text('S26', { rank: t.rank === 'S' ? 'S' : CONFIG.ranks[rankIndex(t.rank) + 1], k: result.k, need: result.need }));
  } else {
    const retryDate = kind === 'trial' ? t.retryAvailableAt : nextDue(t);
    lines.push(text('S27', {
      metric: metricName(t.trialMetric), gap: formatValue(t, gap(t, ctx.value, ctx.target)), date: retryDate && shortDate(retryDate),
    }));
  }

  // The rank-up screen is shown inverted (spec section 3).
  const box = el('section', { class: `finish results fade-in${passed && (result.rankUp || result.star) ? ' inverse' : ''}` },
    lines.map((l, i) => el('p', { class: i === 0 ? 'task' : '' }, l)));
  mount(ctx.root, box);

  if (passed && result.rankUp && t.rank === 'C') {
    box.append(el('p', {}, text('S29', { talent: t.name })), classChangeForm(t, () => afterClassChange(ctx, box, t)));
    return;
  }
  afterClassChange(ctx, box, t);
}

/** S30 for the Main talent, then OK. */
function afterClassChange(ctx, box, t) {
  const ok = el('button', { type: 'button', class: 'btn btn-primary btn-start', onclick: () => app.home() }, raw('L14'));
  if (t.role !== 'main') {
    box.append(el('div', { class: 'focus-bottom' }, ok));
    return;
  }
  const question = el('div', { class: 'stack' },
    el('p', {}, text('S30', { talent: t.name })),
    el('div', { class: 'inline' },
      el('button', { type: 'button', class: 'btn', onclick: () => chooseNewMain(t) }, raw('L12')),
      el('button', { type: 'button', class: 'btn', onclick: () => app.home() }, raw('L13'))));
  box.append(question);
}

function chooseNewMain(current) {
  const others = state.talents.filter((x) => x.id !== current.id && x.role !== 'dormant');
  if (!others.length) {
    app.home();
    return;
  }
  openSheet(el('div', { class: 'stack' },
    ...others.map((o) => el('button', {
      type: 'button',
      class: 'btn',
      onclick: () => {
        closeSheet();
        confirmMainSwitch(o.id, () => app.home());
      },
    }, o.name)),
    el('button', { type: 'button', class: 'btn-text', onclick: closeSheet }, raw('L03'))));
}

/** Make a talent Main; ask S55 about moving the old Main's slots when it has any. */
export function confirmMainSwitch(talentId, onDone) {
  const target = talentById(talentId);
  const oldMain = state.talents.find((t) => t.role === 'main' && t.id !== talentId);
  const count = oldMain ? state.slots.filter((s) => s.talentId === oldMain.id).length : 0;
  const apply = async (moveSlots) => {
    closeSheet();
    await applyUpdates(roleChange(state, talentId, 'main', { moveSlots }));
    onDone();
  };
  if (!count) {
    apply(false);
    return;
  }
  openSheet(el('div', { class: 'stack' },
    el('p', {}, text('S55', { count, talent: target.name })),
    el('button', { type: 'button', class: 'btn btn-primary', onclick: () => apply(true) }, raw('L12')),
    el('button', { type: 'button', class: 'btn', onclick: () => apply(false) }, raw('L13'))));
}

/** Rank C: new material for the 4 attributes and a new trial piece (both optional). */
function classChangeForm(talent, onDone) {
  const attrs = attrsOf(talent.id);
  const inputs = attrs.map((a) => textInput(a.material, { maxlength: 120 }));
  const piece = textInput(talent.trialWork, { maxlength: 80 });
  const metric = segmented(METRICS.map((v, i) => ({ value: v, label: raw('L51')[i] })), talent.trialMetric);
  const unit = textInput(talent.trialMetricUnit, { maxlength: 20 });
  const L61 = raw('L61');
  const form = el('div', { class: 'stack' },
    ...attrs.map((a, i) => field(a.name, inputs[i])),
    field(L61[4], piece),
    field(L61[5], metric.node),
    field(L61[6], unit),
    el('button', {
      type: 'button',
      class: 'btn btn-primary',
      onclick: async () => {
        const now = Date.now();
        const changedAttrs = attrs
          .map((a, i) => ({ a, v: inputs[i].value.trim() }))
          .filter(({ a, v }) => v && v !== a.material)
          .map(({ a, v }) => replaceMaterial(a, v, now));
        const pieceChanged = piece.value.trim() !== talent.trialWork || metric.value !== talent.trialMetric || unit.value.trim() !== talent.trialMetricUnit;
        const t = pieceChanged ? {
          ...talentById(talent.id),
          trialWork: piece.value.trim(),
          trialMetric: metric.value,
          trialMetricUnit: unit.value.trim(),
          baselineNeeded: true, // the next trial starts with a baseline of the new piece
        } : null;
        await applyUpdates({ attrs: changedAttrs, talents: t ? [t] : [] });
        form.replaceChildren();
        onDone();
      },
    }, raw('L21')),
    el('button', { type: 'button', class: 'btn', onclick: () => { form.replaceChildren(); onDone(); } }, raw('L15')));
  return form;
}

// ---- Baseline and awaken ----

async function saveBaseline(ctx) {
  leaveTrial();
  const now = new Date();
  const talent = {
    ...ctx.talent,
    baselineDone: true,
    baselineNeeded: false,
    // A new-piece baseline takes the place of that trial: the cycle restarts today.
    cycleStart: ctx.talent.baselineNeeded ? dateKey(now) : ctx.talent.cycleStart,
  };
  talent.nextTrialDue = nextDue(talent);
  await saveTrial({ trial: trialRecord(ctx, 'baseline', null), talent, media: mediaOf(ctx) });
  app.home();
}

async function saveAwaken(ctx) {
  leaveTrial();
  const now = new Date();
  const change = roleChange(state, ctx.talent.id, ctx.role, { now });
  const [awakened, ...others] = change.talents;
  await saveTrial({
    trial: trialRecord(ctx, 'awakenRetest', null),
    talent: awakened,
    media: mediaOf(ctx),
    attrs: awakenAttributes(attrsOf(ctx.talent.id), now),
  });
  if (others.length) await applyUpdates({ talents: others });
  mount(ctx.root, el('section', { class: 'finish results fade-in' },
    el('p', { class: 'task' }, text('S36')),
    el('div', { class: 'focus-bottom' },
      el('button', { type: 'button', class: 'btn btn-primary btn-start', onclick: () => app.home() }, raw('L14')))));
}
