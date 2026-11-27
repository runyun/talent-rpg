// Add talent: 7 pages, one question each (spec 5.6), the optional Ask AI page (5.6.1),
// and Set up for talents from before data v5 (6.19: pages 2-4, prefilled, Save on page 4).

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import { dateKey } from '../time.js';
import {
  fmtNumber, fmtStep, fmtValue, parseNumber,
} from '../format.js';
import {
  state, newId, addTalent, saveTalent, addMetric, talentById,
} from '../store.js';
import {
  applySetup, normalizeStep, roundValue, totalSteps,
} from '../model/practice.js';
import { newTalentRoleOptions } from '../model/roles.js';
import {
  backButton, exampleBox, field, textInput, numberInput, toggle, copyText,
} from './widgets.js';
import { slotFields } from './sheets.js';

const EPS = 1e-9;

// ---- Step slider (5.6.2) ----

/**
 * The step range for a gap: gap/50 .. gap/5 (5-50 steps), default gap/12, in units of 1
 * (whole numbers) or 0.1. Returns null when Now or Goal is missing, { equal: true } when they match.
 */
export function stepRange(now, goal, wholeNumbers) {
  if (now === null || goal === null) return null;
  const gap = Math.abs(goal - now);
  if (gap < EPS) return { equal: true };
  const unit = wholeNumbers ? 1 : 0.1;
  const cfg = CONFIG.stepSlider;
  const toUnits = (v) => Math.round(v / unit);
  const min = Math.max(1, Math.ceil(gap / cfg.maxSteps / unit - EPS));
  const max = Math.floor(gap / cfg.minSteps / unit + EPS);
  const def = Math.min(Math.max(toUnits(gap / cfg.defaultSteps), min), Math.max(min, max));
  return {
    gap, unit, min, max, def, possible: max >= min,
  };
}

// ---- Ask AI answer (5.6.1) ----

/** Read "Focus: ...", "Unit: ...", "Now:", "Goal:", "Step:", "Whole numbers:", "Checks:" lines. */
export function parseAiAnswer(answer) {
  const out = {};
  const firstNumber = (s) => {
    const m = s.match(/-?\d[\d,]*(\.\d+)?/);
    return m ? parseNumber(m[0]) : null;
  };
  for (const rawLine of String(answer || '').split(/\r?\n/)) {
    // Lists and bold marks that chat apps often add are ignored.
    const line = rawLine.trim().replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim();
    const m = line.match(/^(focus|unit|now|goal|step|whole numbers|checks)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const rest = m[2].trim();
    if (key === 'focus' && rest) out.focus = rest;
    else if (key === 'unit') out.unit = rest;
    else if (key === 'now') out.now = firstNumber(rest);
    else if (key === 'goal') out.goal = firstNumber(rest);
    else if (key === 'step') out.step = firstNumber(rest);
    else if (key === 'whole numbers') {
      if (/^y/i.test(rest)) out.wholeNumbers = true;
      else if (/^n/i.test(rest)) out.wholeNumbers = false;
    } else if (key === 'checks') out.checks = rest.split(';').map((s) => s.trim()).filter(Boolean).slice(0, 3);
  }
  for (const k of ['now', 'goal', 'step']) if (out[k] === null) delete out[k];
  const ok = Boolean(out.focus) || out.goal !== undefined;
  return ok ? out : null;
}

/** The prompt to copy (S230 with {goalLine}; " · " becomes a new line). */
export function aiPrompt(name, goal, unit) {
  const g = goal === null ? null : (unit ? `${fmtNumber(goal)} ${unit}` : fmtNumber(goal));
  const goalLine = g === null ? text('S230_GOAL_LINE', {}, 1) : text('S230_GOAL_LINE', { goal: g }, 0);
  return text('S230', { talent: name, goalLine }).split(' · ').join('\n');
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
    stepUnits: null, // chosen step in slider units (1 or 0.1); null = default
    checks: setupTalent ? (setupTalent.checks || []).slice() : [],
    role: null,
    days: [],
    anchor: '',
    time: lastSlot ? lastSlot.time : '21:00',
  };
  const pages = setupTalent ? [2, 3, 4] : [1, 2, 3, 4, 5, 6];
  let at = 0;
  let notice = null; // S233 after Ask AI
  let saving = false;

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
  const currentStep = () => {
    const r = range();
    if (!r || r.equal) return null;
    const units = f.stepUnits === null ? r.def : Math.min(Math.max(f.stepUnits, r.min), Math.max(r.min, r.max));
    return normalizeStep(units * r.unit, f.wholeNumbers);
  };

  function show() {
    const page = pages[at];
    const built = PAGE[page]();
    const top = el('div', { class: 'flow-top' },
      at > 0 ? backButton(() => { at -= 1; show(); }) : el('span'),
      !onboarding ? el('button', {
        type: 'button', class: 'btn-text', onclick: () => { cleanup(); onCancel(); },
      }, raw('L03')) : el('span'));
    const progress = el('div', { class: 'flow-progress' }, el('span', { style: `width:${Math.round(((at + 1) / pages.length) * 100)}%` }));
    mount(root, el('section', { class: 'flow fade-in' }, top, progress,
      notice ? el('p', { class: 'muted small' }, notice) : null,
      el('div', { class: 'flow-body' }, built.body),
      el('div', { class: 'flow-bottom' }, built.bottom)));
    notice = null;
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

  // Page 3: now, goal, unit, whole numbers, step.
  function page3() {
    const L137 = raw('L137');
    const now = numberInput(f.now === null ? '' : f.now);
    const goal = numberInput(f.goal === null ? '' : f.goal);
    const unit = textInput(f.unit, { maxlength: 20, autocapitalize: 'none' });
    const sliderLabel = el('p', { class: 'small' });
    const slider = el('input', { type: 'range', class: 'slider' });
    const result = el('div', { class: 'result-card' });
    const below = el('p', { class: 'muted small' }, text('S242'));
    const go = nextButton(false, next);
    const sliderBox = el('div', { class: 'stack' }, sliderLabel, slider);

    const paint = () => {
      const r = range();
      const t = { unit: f.unit, wholeNumbers: f.wholeNumbers };
      if (!r) {
        sliderBox.hidden = true;
        result.hidden = true;
        go.disabled = true;
        return;
      }
      result.hidden = false;
      if (r.equal) {
        sliderBox.hidden = true;
        result.replaceChildren(el('p', {}, text('S243')));
        go.disabled = true;
        return;
      }
      sliderBox.hidden = false;
      const step = currentStep();
      const dir = f.goal >= f.now ? 1 : -1;
      slider.min = String(r.min);
      slider.max = String(Math.max(r.min, r.max));
      slider.step = '1';
      slider.value = String(Math.round(step / r.unit));
      slider.disabled = !r.possible || r.max <= r.min;
      sliderLabel.textContent = text('S239', { step: fmtStep(t, step, dir) });
      const n = totalSteps(f.now, f.goal, step);
      result.replaceChildren(
        el('p', { class: 'num' }, text('S240', { value: fmtValue(t, roundValue(f.wholeNumbers, f.now)) })),
        el('p', { class: 'muted small num' }, text('S241', { n, k: 2 * n })),
      );
      // At least 5 steps are needed to cut 5 ranks (6.3).
      go.disabled = !(r.possible && n >= CONFIG.stepSlider.minSteps);
    };

    now.addEventListener('input', () => { f.now = parseNumber(now.value); f.stepUnits = null; paint(); });
    goal.addEventListener('input', () => { f.goal = parseNumber(goal.value); f.stepUnits = null; paint(); });
    unit.addEventListener('input', () => { f.unit = unit.value.trim(); paint(); });
    slider.addEventListener('input', () => { f.stepUnits = Number(slider.value); paint(); });
    const whole = toggle(f.wholeNumbers, (on) => { f.wholeNumbers = on; f.stepUnits = null; paint(); }, raw('L138'));
    paint();
    return {
      body: [question('S238'),
        el('div', { class: 'triple' }, field(L137[0], now), field(L137[1], goal), field(L137[2], unit)),
        el('label', { class: 'row row-plain' }, el('span', { class: 'row-label' }, raw('L138')), whole),
        sliderBox, result, below, exampleBox('S244', text)],
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
    }, el('span', { class: 'choice-title' }, raw(key)),
    // S249 starts each meaning with the role name ("Main: ..."); the title already shows it.
    el('span', { class: 'muted small' }, meanings[i].startsWith(`${raw(key)}: `) ? meanings[i].slice(raw(key).length + 2) : meanings[i])));
    return { body: [question('S248'), ...buttons, note, limitNote], bottom: null };
  }

  // Page 6: slots.
  function page6() {
    const form = slotFields({ days: f.days, anchor: f.anchor, time: f.time });
    const count = f.role === 'main' ? CONFIG.slots.mainDaysPerWeek : CONFIG.slots.maintainDaysPerWeek;
    const keep = () => {
      f.days = form.days();
      f.anchor = form.anchor();
      f.time = form.time();
    };
    form.node.addEventListener('click', keep);
    form.node.addEventListener('change', keep);
    form.node.addEventListener('input', keep);
    const saveBtn = nextButton(true, () => { keep(); save(form); }, raw('L21'));
    const skip = el('button', { type: 'button', class: 'btn-text', onclick: () => save(null) }, raw('L15'));
    const days = form.node.firstChild;
    days.after(el('p', { class: 'muted small' }, text('S121', { count })));
    return {
      body: [question('S251'), form.node, exampleBox('S134', text), el('p', { class: 'muted small' }, text('S252'))],
      bottom: el('div', { class: 'stack' }, saveBtn, skip),
    };
  }

  const PAGE = {
    1: page1, 2: page2, 3: page3, 4: page4, 5: page5, 6: page6,
  };

  async function save(form = null) {
    if (saving) return;
    saving = true;
    const now = Date.now();
    const whole = f.wholeNumbers;
    const talent = {
      id: newId(),
      schema: 5,
      name: f.name.trim(),
      role: f.role,
      roleSince: dateKey(new Date(now)),
      createdAt: now,
      rank: 'E',
      stars: 0,
      reachedCAt: null,
      focus: f.focus.trim(),
      unit: f.unit.trim(),
      wholeNumbers: whole,
      estimate: roundValue(whole, f.now),
      start: null,
      goal: roundValue(whole, f.goal),
      step: currentStep(),
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
    const slots = form && talent.role !== 'dormant' ? form.build(talent.id, now) : [];
    await addTalent(talent, slots);
    addMetric({ type: 'addTalent', at: now, seconds: Math.round((now - openedAt) / 1000) });
    cleanup();
    onDone(talent);
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
    const error = el('p', { class: 'muted small', hidden: true }, text('S232'));
    const fill = el('button', {
      type: 'button',
      class: 'btn btn-primary btn-main',
      onclick: () => {
        const got = parseAiAnswer(answer.value);
        if (!got) {
          error.hidden = false;
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
        notice = text('S233');
        at = 1; // page 2
        show();
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
        error),
      el('div', { class: 'flow-bottom' }, fill)));
    onViewport();
  }

  show();
  return cleanup;
}
