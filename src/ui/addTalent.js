// Add talent: 7 pages, one question each (spec 5.6), the optional Ask AI page (5.6.1),
// and Set up for talents from before data v5 (6.19: pages 2-4, prefilled, Save on page 4).

import { el, mount, svg } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import { dateKey } from '../time.js';
import {
  fmtNumber, fmtStep, fmtValue, parseNumber,
} from '../format.js';
import {
  state, newId, addTalent, saveTalent, addMetric, talentById, applyUpdates,
} from '../store.js';
import {
  applySetup, normalizeStep, roundValue, totalSteps,
} from '../model/practice.js';
import { newTalentRoleOptions, slotUse } from '../model/roles.js';
import {
  backButton, exampleBox, field, textInput, numberInput, toggle, copyText,
} from './widgets.js';
import { slotFields } from './sheets.js';

const EPS = 1e-9;
const CHECK_ICON = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';

// ---- Step size (5.6.2) ----

/**
 * The step range for a gap, in units of 1 (whole numbers) or 0.1:
 * min = max(1 unit, ceil(gap / 50)), max = floor(gap / 5), default gap / 12 kept in [min, max].
 * Returns null when Now or Goal is missing, { equal: true } when they match. kind:
 * 'slider' (max > min), 'single' (max = min), 'tooSmall' (max < min: no 5 steps possible).
 */
export function stepRange(now, goal, wholeNumbers) {
  if (now === null || now === undefined || goal === null || goal === undefined) return null;
  const gap = Math.abs(goal - now);
  if (gap < EPS) return { equal: true };
  const unit = wholeNumbers ? 1 : 0.1;
  const cfg = CONFIG.stepSlider;
  const min = Math.max(1, Math.ceil(gap / cfg.maxSteps / unit - EPS));
  const max = Math.floor(gap / cfg.minSteps / unit + EPS);
  const def = Math.min(Math.max(Math.round(gap / cfg.defaultSteps / unit), min), Math.max(min, max));
  let kind = 'slider';
  if (max === min) kind = 'single';
  if (max < min) kind = 'tooSmall';
  return {
    gap, unit, min, max, def, kind, possible: max >= min,
  };
}

/** The step (a number) for a range and chosen units; units outside the range are clamped. */
export function stepFor(r, units) {
  if (!r || r.equal || !r.possible) return null;
  const u = units === null || units === undefined ? r.def : Math.min(Math.max(units, r.min), r.max);
  return normalizeStep(u * r.unit, r.unit === 1);
}

/**
 * The step block of Add talent page 3 and Target & step (5.8.1): slider (or S296), S239, S311,
 * and the result card filled by `result(step, r)`. get(): { now, goal, wholeNumbers, unit, units }.
 * onUnits(units) stores a slider move. Returns { node, paint, ok() }.
 */
export function stepBlock({ get, onUnits, result }) {
  const label = el('p', { class: 'small num' });
  const single = el('p', { class: 'muted small' }, text('S296'));
  const slider = el('input', { type: 'range', class: 'slider', step: '1' });
  const explain = el('p', { class: 'muted small' }, text('S311'));
  const card = el('div', { class: 'result-card' });
  const box = el('div', { class: 'stack' }, label, slider, single, explain);
  let ok = false;
  slider.addEventListener('input', () => {
    onUnits(Number(slider.value));
    paint();
  });
  function paint() {
    const v = get();
    const t = { unit: v.unit, wholeNumbers: v.wholeNumbers };
    const r = stepRange(v.now, v.goal, v.wholeNumbers);
    ok = false;
    if (!r) {
      box.hidden = true;
      card.hidden = true;
      return;
    }
    card.hidden = false;
    if (r.equal) {
      box.hidden = true;
      card.replaceChildren(el('p', {}, text('S243')));
      return;
    }
    if (r.kind === 'tooSmall') {
      box.hidden = true;
      card.replaceChildren(
        el('p', {}, text('S294', { gap: fmtValue(t, v.wholeNumbers ? 5 : 0.5) })),
        el('p', { class: 'muted small' }, text('S295')),
      );
      return;
    }
    box.hidden = false;
    const step = stepFor(r, v.units);
    const dir = v.goal >= v.now ? 1 : -1;
    label.textContent = text('S239', { step: fmtStep(t, step, dir) });
    slider.hidden = r.kind !== 'slider';
    single.hidden = r.kind !== 'single';
    slider.min = String(r.min);
    slider.max = String(r.max);
    slider.value = String(Math.round(step / r.unit));
    const n = totalSteps(v.now, v.goal, step);
    card.replaceChildren(...result(step, n, t));
    ok = n >= CONFIG.stepSlider.minSteps;
  }
  return {
    node: el('div', { class: 'stack' }, box, card), paint, ok: () => ok,
  };
}

// ---- Ask AI answer (5.6.1) ----

const LABELS = [
  ['wholeNumbers', 'whole numbers?'],
  ['focus', 'focus'],
  ['unit', 'units?'],
  ['now', 'now|current|start'],
  ['goal', 'goal|target'],
  ['step', 'step'],
  ['checks', 'checks?'],
];
const LABEL_RE = new RegExp(`(?:^|[^a-z])(${LABELS.map(([, p]) => p).join('|')})\\s*:`, 'gi');

function keyOfLabel(word) {
  const w = word.toLowerCase();
  for (const [key, p] of LABELS) if (new RegExp(`^(?:${p})$`).test(w)) return key;
  return null;
}

const firstNumber = (s) => {
  const m = String(s).match(/-?\d[\d,]*(\.\d+)?|-?\.\d+/);
  return m ? { n: parseNumber(m[0]), after: s.slice(m.index + m[0].length) } : null;
};

/** Clean a value: trim, drop trailing ·,. and brackets or quotes around the whole value. */
function cleanValue(v) {
  let s = v.trim().replace(/[\s·,.]+$/, '').trim();
  const pairs = [['(', ')'], ['[', ']'], ['"', '"'], ["'", "'"], ['“', '”']];
  for (const [a, b] of pairs) if (s.startsWith(a) && s.endsWith(b) && s.length >= 2) s = s.slice(1, -1).trim();
  return s;
}

/**
 * Read an AI answer: labels anywhere in the text (several on one line, markdown, list marks,
 * numbering and full-width colons are fine). Returns {} fields found (possibly empty).
 */
export function parseAiAnswer(answer) {
  const lines = String(answer || '').replace(/\uFF1A/g, ':').split(/\r?\n/).map((line) => line
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(?:[#\-*•·]+|\d+[.)])\s*/, ''));
  const found = {};
  for (const line of lines) {
    const hits = [];
    LABEL_RE.lastIndex = 0;
    let m;
    while ((m = LABEL_RE.exec(line)) !== null) {
      hits.push({ key: keyOfLabel(m[1]), labelAt: m.index + m[0].search(/[a-z]/i), valueAt: m.index + m[0].length });
    }
    hits.forEach((h, i) => {
      if (!h.key || found[h.key] !== undefined) return;
      const end = i + 1 < hits.length ? hits[i + 1].labelAt : line.length;
      found[h.key] = cleanValue(line.slice(h.valueAt, end));
    });
  }
  const out = {};
  if (found.focus) out.focus = found.focus;
  if (found.unit) out.unit = found.unit;
  for (const k of ['now', 'goal', 'step']) {
    if (found[k] === undefined) continue;
    const num = firstNumber(found[k]);
    if (num && num.n !== null) {
      out[k] = num.n;
      if (!out.unit && (k === 'goal' || k === 'now') && !found.unit) {
        const word = num.after.trim().replace(/^[(\s]+/, '').split(/[\s(),.;]+/)[0];
        if (word) out.unit = word;
      }
    }
  }
  if (!found.unit && out.unit === undefined) delete out.unit;
  if (found.wholeNumbers !== undefined) {
    if (/^(yes|y|true)\b/i.test(found.wholeNumbers)) out.wholeNumbers = true;
    else if (/^(no|n|false)\b/i.test(found.wholeNumbers)) out.wholeNumbers = false;
  }
  if (out.wholeNumbers === undefined && (out.now !== undefined || out.goal !== undefined)) {
    out.wholeNumbers = ['now', 'goal', 'step'].every((k) => out[k] === undefined || Number.isInteger(out[k]));
  }
  if (found.checks) {
    const sep = found.checks.includes(';') ? ';' : ',';
    const checks = found.checks.split(sep).map((x) => cleanValue(x)).filter(Boolean).slice(0, 3);
    if (checks.length) out.checks = checks;
  }
  return out;
}

/** The prompt to copy (S230 with {goalLine}; " · " becomes a new line). */
export function aiPrompt(name, goal, unit) {
  const g = goal === null ? null : (unit ? `${fmtNumber(goal)} ${unit}` : fmtNumber(goal));
  const goalLine = g === null ? text('S230_GOAL_LINE', {}, 1) : text('S230_GOAL_LINE', { goal: g }, 0);
  return text('S230', { talent: name, goalLine }).split(' · ').join('\n');
}

/** The role a talent gets when Ask AI saves it right away (spec 5.6.1, 6.13). */
function autoRole() {
  const { used, slots } = slotUse(state);
  if (used >= slots) return 'dormant';
  return state.talents.some((t) => t.role === 'main') ? 'maintain' : 'main';
}

function newTalentRecord(f, step, now) {
  const whole = f.wholeNumbers;
  return {
    id: newId(),
    schema: 5,
    name: f.name.trim(),
    shortName: null,
    role: f.role,
    roleSince: dateKey(new Date(now)),
    createdAt: now,
    rank: 'E',
    stars: 0,
    reachedCAt: null,
    focus: f.focus.trim(),
    unit: (f.unit || '').trim(),
    wholeNumbers: whole,
    estimate: roundValue(whole, f.now),
    start: null,
    goal: roundValue(whole, f.goal),
    step,
    target: null,
    rankValues: null,
    passStreak: 0,
    missStreak: 0,
    lastPass: null,
    bounces: {},
    plateau: { active: false, since: null, checkpointOffered: false },
    challenge: {
      openRank: null, lastAttemptDate: null, failedAt: null, practicedSinceFail: false, askedFirst: [],
    },
    starPassesAtGoal: 0,
    checks: f.checks.map((c) => (c || '').trim()).filter(Boolean).slice(0, 3),
    needsWork: [],
    fixed: [],
    needsSetup: false,
    findStart: null,
  };
}

// ---- The flow ----

/**
 * renderAddTalent(root, { onboarding, setupId, onDone(talent), onCancel })
 * setupId: Set up an existing talent (pages 2-4 only).
 */
export function renderAddTalent(root, {
  onboarding = false, setupId = null, onDone, onCancel,
}) {
  const setupTalent = setupId ? talentById(setupId) : null;
  const openedAt = Date.now();
  const lastSlot = state.slots.slice().sort((a, b) => a.createdAt - b.createdAt).pop();
  const f = {
    name: setupTalent ? setupTalent.name : '',
    goal: setupTalent ? setupTalent.goal : null,
    unit: setupTalent ? setupTalent.unit || '' : '',
    focus: setupTalent ? setupTalent.focus || '' : '',
    now: setupTalent ? (setupTalent.start !== null && setupTalent.start !== undefined ? setupTalent.start : setupTalent.estimate) : null,
    wholeNumbers: setupTalent ? setupTalent.wholeNumbers !== false : true,
    stepUnits: null, // chosen step in slider units; null = default
    checks: setupTalent ? (setupTalent.checks || []).slice() : [],
    role: null,
    days: [],
    anchor: '',
    time: lastSlot ? lastSlot.time : '21:00',
  };
  const pages = setupTalent ? [2, 3, 4] : [1, 2, 3, 4, 5, 6];
  let at = 0;
  let saving = false;
  let added = null; // the talent saved straight from Ask AI (page 6 only)

  // Keep the bottom button right above the keyboard (spec 5.6).
  const vv = window.visualViewport;
  const onViewport = () => {
    const bar = root.querySelector('.flow-bottom');
    if (!bar || !vv) return;
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    bar.style.bottom = `${covered}px`;
  };
  if (vv) {
    vv.addEventListener('resize', onViewport);
    vv.addEventListener('scroll', onViewport);
  }
  const cleanup = () => {
    if (vv) {
      vv.removeEventListener('resize', onViewport);
      vv.removeEventListener('scroll', onViewport);
    }
  };

  const range = () => stepRange(f.now, f.goal, f.wholeNumbers);
  const currentStep = () => stepFor(range(), f.stepUnits);

  function show() {
    const page = pages[at];
    const built = PAGE[page]();
    const top = el('div', { class: 'flow-top' },
      at > 0 && !added ? backButton(() => { at -= 1; show(); }) : el('span'),
      !onboarding && !added ? el('button', {
        type: 'button', class: 'btn-text', onclick: () => { cleanup(); onCancel(); },
      }, raw('L03')) : el('span'));
    const progress = el('div', { class: 'flow-progress' }, el('span', { style: `width:${Math.round(((at + 1) / pages.length) * 100)}%` }));
    mount(root, el('section', { class: 'flow fade-in' }, top, progress,
      el('div', { class: 'flow-body' }, built.body),
      built.bottom ? el('div', { class: 'flow-bottom' }, built.bottom) : null));
    onViewport();
    if (built.focus) setTimeout(() => built.focus.focus(), 50);
  }

  const next = () => {
    at += 1;
    show();
  };

  const nextButton = (enabled, onClick = next, label = raw('L87')) => {
    const b = el('button', { type: 'button', class: 'btn btn-primary btn-main', onclick: () => { if (!b.disabled) onClick(); } }, label);
    b.disabled = !enabled;
    return b;
  };

  const question = (key) => el('h1', { class: 'flow-q' }, text(key));
  const help = (key) => el('p', { class: 'muted' }, text(key));

  // Page 1: name and goal.
  function page1() {
    const name = textInput(f.name, { maxlength: 60 });
    const goal = numberInput(f.goal === null ? '' : f.goal);
    const unit = textInput(f.unit, { maxlength: 20, autocapitalize: 'none' });
    const L137 = raw('L137');
    const go = nextButton(Boolean(f.name.trim()));
    const ai = el('button', { type: 'button', class: 'btn', disabled: !f.name.trim() || undefined, onclick: () => askAi() }, raw('L133'));
    name.addEventListener('input', () => {
      f.name = name.value;
      go.disabled = !f.name.trim();
      ai.disabled = !f.name.trim();
    });
    goal.addEventListener('input', () => { f.goal = parseNumber(goal.value); f.stepUnits = null; });
    unit.addEventListener('input', () => { f.unit = unit.value.trim(); });
    return {
      body: [question('S106'), name, question('S227'),
        el('div', { class: 'pair' }, field(L137[1], goal), field(L137[2], unit)),
        exampleBox('S126', text), ai],
      bottom: go,
      focus: name,
    };
  }

  // Page 2: focus.
  function page2() {
    const input = textInput(f.focus, { maxlength: 80 });
    const go = nextButton(Boolean(f.focus.trim()));
    input.addEventListener('input', () => {
      f.focus = input.value;
      go.disabled = !f.focus.trim();
    });
    return {
      body: [question('S234'), help('S235'), input, exampleBox('S236', text), el('p', { class: 'muted small' }, text('S237'))],
      bottom: go,
      focus: input,
    };
  }

  // Page 3: now, goal, unit, whole numbers, step (5.6.2).
  function page3() {
    const L137 = raw('L137');
    const now = numberInput(f.now === null ? '' : f.now);
    const goal = numberInput(f.goal === null ? '' : f.goal);
    const unit = textInput(f.unit, { maxlength: 20, autocapitalize: 'none' });
    const go = nextButton(false, next);
    const block = stepBlock({
      get: () => ({
        now: f.now, goal: f.goal, wholeNumbers: f.wholeNumbers, unit: f.unit, units: f.stepUnits,
      }),
      onUnits: (u) => { f.stepUnits = u; },
      result: (step, n, t) => [
        el('p', { class: 'num' }, text('S240', { value: fmtValue(t, roundValue(f.wholeNumbers, f.now)) })),
        el('p', { class: 'muted small num' }, text('S241', { n, k: 2 * n })),
      ],
    });
    const paint = () => {
      block.paint();
      go.disabled = !block.ok();
    };
    now.addEventListener('input', () => { f.now = parseNumber(now.value); f.stepUnits = null; paint(); });
    goal.addEventListener('input', () => { f.goal = parseNumber(goal.value); f.stepUnits = null; paint(); });
    unit.addEventListener('input', () => { f.unit = unit.value.trim(); paint(); });
    block.node.addEventListener('input', () => { go.disabled = !block.ok(); });
    const whole = toggle(f.wholeNumbers, (on) => { f.wholeNumbers = on; f.stepUnits = null; paint(); }, raw('L138'));
    paint();
    return {
      body: [question('S238'),
        el('div', { class: 'triple' }, field(L137[0], now), field(L137[1], goal), field(L137[2], unit)),
        el('label', { class: 'row row-plain' }, el('span', { class: 'row-label' }, raw('L138')), whole),
        block.node, el('p', { class: 'muted small' }, text('S242')), exampleBox('S244', text)],
      bottom: go,
      focus: f.now === null ? now : null,
    };
  }

  // Page 4: up to 3 checks (optional).
  function page4() {
    const box = el('div', { class: 'stack' });
    const inputs = [];
    const bottom = el('div');
    const paintBottom = () => {
      const any = f.checks.some((c) => c && c.trim());
      if (setupTalent) bottom.replaceChildren(nextButton(true, saveSetup, raw('L21')));
      else bottom.replaceChildren(nextButton(true, next, any ? raw('L87') : raw('L15')));
    };
    const addInput = (value) => {
      const i = inputs.length;
      const input = textInput(value, { maxlength: 80 });
      input.addEventListener('input', () => {
        f.checks[i] = input.value;
        if (input.value.trim() && i === inputs.length - 1 && inputs.length < 3) addInput('');
        paintBottom();
      });
      inputs.push(input);
      box.append(input);
    };
    const start = f.checks.filter((c) => c && c.trim());
    f.checks = start.slice();
    start.forEach((c) => addInput(c));
    if (inputs.length < 3) addInput('');
    paintBottom();
    return {
      body: [question('S245'), help('S246'), box, exampleBox('S247', text)],
      bottom,
      focus: inputs[0],
    };
  }

  // Page 5: role.
  function page5() {
    const opt = newTalentRoleOptions(state);
    const meanings = raw('S249');
    const note = el('p', { class: 'muted small', hidden: !opt.full }, text('S250', { used: opt.used, slots: opt.slots }));
    const limitNote = el('p', { class: 'muted small', hidden: true });
    const roles = [
      ['main', 'L45', opt.main],
      ['maintain', 'L46', opt.maintain],
      ['dormant', 'L47', { disabled: false }],
    ];
    const buttons = roles.map(([role, key, o], i) => el('button', {
      type: 'button',
      class: `btn btn-choice${o.disabled ? ' off' : ''}${f.role === role ? ' on' : ''}`,
      'aria-disabled': o.disabled ? 'true' : undefined,
      onclick: () => {
        if (o.disabled) {
          limitNote.textContent = text('L56', { count: o.limit });
          limitNote.hidden = false;
          return;
        }
        f.role = role;
        if (role === 'dormant') save();
        else next();
      },
    }, el('span', { class: 'choice-title' }, raw(key)), el('span', { class: 'muted small' }, meanings[i])));
    return { body: [question('S248'), ...buttons, note, limitNote], bottom: null };
  }

  // Page 6: slots. After Ask AI saved the talent, it starts with a result card.
  function page6() {
    const form = slotFields({ days: f.days, anchor: f.anchor, time: f.time });
    const role = added ? added.role : f.role;
    const count = role === 'main' ? CONFIG.slots.mainDaysPerWeek : CONFIG.slots.maintainDaysPerWeek;
    const keep = () => {
      f.days = form.days();
      f.anchor = form.anchor();
      f.time = form.time();
    };
    form.node.addEventListener('click', keep);
    form.node.addEventListener('change', keep);
    form.node.addEventListener('input', keep);
    const saveBtn = nextButton(true, () => { keep(); (added ? saveSlotsOnly : save)(form); }, raw('L21'));
    const skip = el('button', { type: 'button', class: 'btn-text', onclick: () => (added ? saveSlotsOnly(null) : save(null)) }, raw('L15'));
    const days = form.node.firstChild;
    days.after(el('p', { class: 'muted small' }, text('S121', { count })));
    const body = [];
    if (added) body.push(addedCard(added));
    body.push(question('S251'), form.node, exampleBox('S134', text), el('p', { class: 'muted small' }, text('S252')));
    return { body, bottom: el('div', { class: 'stack' }, saveBtn, skip) };
  }

  /** What Ask AI filled in (S289-S292). */
  function addedCard(t) {
    const dir = t.goal >= t.estimate ? 1 : -1;
    const checks = (t.checks || []).length;
    return el('div', { class: 'result-card added-card' },
      el('div', { class: 'added-head' }, el('span', { class: 'check-icon small-check' }, svg(CHECK_ICON)),
        el('p', { class: 'talent-name' }, text('S289', { talent: t.name }))),
      el('p', {}, t.focus),
      el('p', { class: 'muted small num' }, text('S290', {
        role: raw({ main: 'L45', maintain: 'L46', dormant: 'L47' }[t.role]), value: fmtValue(t, t.estimate), goal: fmtValue(t, t.goal),
      })),
      el('p', { class: 'muted small num' }, text('S291', { step: fmtStep(t, t.step, dir), n: checks || null })),
      el('p', { class: 'muted small' }, text('S292')));
  }

  const PAGE = {
    1: page1, 2: page2, 3: page3, 4: page4, 5: page5, 6: page6,
  };

  async function save(form = null) {
    if (saving) return;
    saving = true;
    const now = Date.now();
    const talent = newTalentRecord(f, currentStep(), now);
    const slots = form && talent.role !== 'dormant' ? form.build(talent.id, now) : [];
    await addTalent(talent, slots);
    addMetric({ type: 'addTalent', at: now, seconds: Math.round((now - openedAt) / 1000) });
    cleanup();
    onDone(talent);
  }

  async function saveSlotsOnly(form) {
    if (saving) return;
    saving = true;
    const slots = form ? form.build(added.id, Date.now()) : [];
    if (slots.length) await applyUpdates({ slots });
    cleanup();
    onDone(added);
  }

  async function saveSetup() {
    if (saving) return;
    saving = true;
    const t = talentById(setupTalent.id);
    const next5 = applySetup(t, {
      focus: f.focus.trim(),
      unit: f.unit.trim(),
      now: f.now,
      goal: f.goal,
      step: currentStep(),
      wholeNumbers: f.wholeNumbers,
      checks: f.checks.map((c) => (c || '').trim()).filter(Boolean).slice(0, 3),
    });
    await saveTalent(next5);
    cleanup();
    onDone(next5);
  }

  // ---- Ask AI (5.6.1) ----
  function askAi() {
    const prompt = aiPrompt(f.name.trim(), f.goal, f.unit.trim());
    const copyBtn = el('button', { type: 'button', class: 'btn' }, raw('L135'));
    copyBtn.addEventListener('click', async () => {
      if (await copyText(prompt)) {
        copyBtn.textContent = text('S90');
        setTimeout(() => { copyBtn.textContent = raw('L135'); }, 2000);
      }
    });
    const answer = el('textarea', { rows: '7', class: 'answer' });
    const message = el('p', { class: 'muted small', hidden: true });
    const fill = el('button', {
      type: 'button',
      class: 'btn btn-primary btn-main',
      onclick: async () => {
        const got = parseAiAnswer(answer.value);
        if (!Object.keys(got).length) {
          message.textContent = text('S232');
          message.hidden = false;
          return;
        }
        if (got.focus) f.focus = got.focus;
        if (got.unit !== undefined) f.unit = got.unit;
        if (got.now !== undefined) f.now = got.now;
        if (got.goal !== undefined) f.goal = got.goal;
        if (got.wholeNumbers !== undefined) f.wholeNumbers = got.wholeNumbers;
        if (got.checks) f.checks = got.checks;
        f.stepUnits = null;
        const r = range();
        if (got.step !== undefined && r && !r.equal && got.step > 0) f.stepUnits = Math.round(got.step / r.unit);
        const cuts = r && !r.equal && r.possible;
        if (f.focus && f.now !== null && f.goal !== null && cuts) {
          // Everything needed: save the talent right away; only page 6 (slots) is left.
          if (saving) return;
          saving = true;
          const now = Date.now();
          f.role = autoRole();
          const talent = newTalentRecord(f, currentStep(), now);
          await addTalent(talent, []);
          addMetric({ type: 'addTalent', at: now, seconds: Math.round((now - openedAt) / 1000) });
          saving = false;
          added = talent;
          at = pages.indexOf(6);
          show();
          return;
        }
        const L162 = raw('L162');
        const missing = [];
        if (!f.focus) missing.push(L162[0]);
        if (f.now === null) missing.push(L162[1]);
        if (f.goal === null || !cuts) missing.push(L162[2]);
        message.textContent = text('S293', { fields: missing.join(', ') });
        message.hidden = false;
        setTimeout(() => {
          at = pages.indexOf(f.focus ? 3 : 2);
          show();
        }, 1500);
      },
    }, raw('L136'));
    mount(root, el('section', { class: 'flow fade-in' },
      el('div', { class: 'flow-top' }, backButton(() => show()),
        !onboarding ? el('button', { type: 'button', class: 'btn-text', onclick: () => { cleanup(); onCancel(); } }, raw('L03')) : el('span')),
      el('div', { class: 'flow-body' },
        el('h1', { class: 'flow-q' }, raw('L134')),
        el('p', { class: 'small' }, text('S229')),
        el('pre', { class: 'prompt-box' }, prompt),
        copyBtn,
        el('p', { class: 'small' }, text('S231')),
        answer,
        message),
      el('div', { class: 'flow-bottom' }, fill)));
    onViewport();
  }

  show();
  return cleanup;
}
