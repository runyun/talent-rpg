// Rank challenge and Checkpoint screens (spec 5.7), and the rank-up card (7.3). Full screen.

import { el, mount } from '../dom.js';
import { text, raw, plain } from '../text.js';
import { CONFIG } from '../config.js';
import { fmtValue } from '../format.js';
import {
  state, talentById, newId, commitRecord, updateOpenMetric,
} from '../store.js';
import { finishRecord } from '../model/record.js';
import { instanceForTalent } from '../model/schedule.js';
import { STAR, challengeEntry, practicedTodayTalent } from '../model/challenge.js';
import { congratsBlock } from './companions.js';
import { backButton } from './widgets.js';
import { app } from './app.js';

const rankWord = (rank) => (rank === STAR ? 'S' : rank);

function rulesList(talent) {
  return el('ol', { class: 'rules' },
    el('li', {}, el('p', {}, text('S195', { talent: talent.name })), el('p', { class: 'muted small' }, text('S196'))),
    el('li', {}, el('p', {}, text('S197'))),
    el('li', {}, el('p', {}, text('S198'))));
}

function valueCard(talent, value) {
  return el('div', { class: 'card challenge-card' },
    el('span', { class: 'part-label small muted' }, raw('L122')),
    el('span', { class: 'target-big num' }, fmtValue(talent, value)),
    el('span', { class: 'card-focus' }, talent.focus));
}

/** Challenge intro (5.7). kind: 'challenge' | 'checkpoint'. */
export function renderChallengeIntro(root, talentId, kind = 'challenge') {
  const t = talentById(talentId);
  if (!t) {
    app.home();
    return;
  }
  const now = new Date();
  if (kind === 'checkpoint') {
    const used = practicedTodayTalent(state, t.id, now);
    const pick = (result) => () => record(t.id, 'checkpoint', result);
    mount(root, el('section', { class: 'full fade-in' },
      el('div', { class: 'page-top' }, backButton(() => app.home())),
      el('h1', { class: 'page-title' }, raw('L125')),
      valueCard(t, t.target),
      el('p', { class: 'muted small' }, text('S210')),
      used ? el('p', { class: 'muted small' }, text('S146', { rank: t.rank })) : null,
      el('div', { class: 'btn-pair btn-pair-big full-bottom' },
        el('button', { type: 'button', class: 'btn btn-primary', disabled: used || undefined, onclick: pick('passed') }, raw('L111')),
        el('button', { type: 'button', class: 'btn btn-outline', disabled: used || undefined, onclick: pick('notYet') }, raw('L112')))));
    return;
  }
  const entry = challengeEntry(state, t, now);
  if (!entry) {
    app.home();
    return;
  }
  const start = el('button', {
    type: 'button',
    class: 'btn btn-primary btn-main',
    disabled: !entry.ready || undefined,
    onclick: () => app.challengeRun(t.id),
  }, raw('L123'));
  mount(root, el('section', { class: 'full fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.challengeBack())),
    el('h1', { class: 'page-title' }, text('S194', { rank: rankWord(entry.rank) })),
    valueCard(t, entry.value),
    rulesList(t),
    el('p', { class: 'muted small' }, text('S199')),
    el('p', { class: 'muted small' }, text('S200')),
    el('div', { class: 'stack full-bottom' },
      entry.ready ? null : el('p', { class: 'muted small' }, text('S146', { rank: rankWord(entry.rank) })),
      start,
      el('button', { type: 'button', class: 'btn btn-text-wide', onclick: () => app.challengeBack() }, raw('L10')))));
}

/** During the challenge: the value, focus and checks; then Passed or Not yet. */
export function renderChallengeRun(root, talentId) {
  const t = talentById(talentId);
  const entry = t && challengeEntry(state, t, new Date());
  if (!entry || !entry.ready) {
    app.home();
    return;
  }
  const checks = (t.checks || []).filter(Boolean);
  const pick = (result) => () => record(t.id, 'challenge', result);
  mount(root, el('section', { class: 'full fade-in' },
    el('p', { class: 'muted small' }, text('S194', { rank: rankWord(entry.rank) })),
    el('div', { class: 'challenge-run' },
      el('span', { class: 'target-big num' }, fmtValue(t, entry.value)),
      el('span', { class: 'card-focus' }, t.focus)),
    checks.length ? el('div', { class: 'card' }, el('span', { class: 'part-label small muted' }, raw('L98')), ...checks.map((c) => el('span', { class: 'check-line' }, c))) : null,
    el('div', { class: 'stack full-bottom' },
      el('p', { class: 'muted small' }, text('S201')),
      el('div', { class: 'btn-pair btn-pair-big' },
        el('button', { type: 'button', class: 'btn btn-primary', onclick: pick('passed') }, raw('L111')),
        el('button', { type: 'button', class: 'btn btn-outline', onclick: pick('notYet') }, raw('L112'))))));
}

async function record(talentId, kind, result) {
  const now = new Date();
  const talent = talentById(talentId);
  const inst = instanceForTalent(state, talentId, now);
  const out = finishRecord({
    state, id: newId(), kind, talent, inst, result, now,
  });
  if (out.error) return;
  await commitRecord(out);
  updateOpenMetric({ practiced: true });
  app.challengeResult({ view: out.view, talent: out.talent, recordId: out.record.id });
}

function resultRow(label, value) {
  return el('div', { class: 'result-row' }, el('span', { class: 'result-label muted small' }, label || ''), el('span', { class: 'result-value' }, value));
}

/** Challenge / Checkpoint result (5.7). */
export function renderChallengeResult(root, { view, talent, recordId }) {
  const L117 = raw('L117');
  const t = talent;
  const parts = [];
  const congrats = () => (view.congrats || []).map((c) => congratsBlock(c.kind, recordId, c.vars)).filter(Boolean);
  const common = () => [
    view.lvNew > view.lvOld ? el('p', { class: 'result-line' }, text('S17', { old: view.lvOld, new: view.lvNew })) : null,
    view.crit ? el('p', { class: 'result-line' }, text(view.crit)) : null,
    view.winNow ? el('p', { class: 'result-line' }, text('S18', { done: view.weekDone, planned: view.weekPlanned, count: view.winCount })) : null,
    ...(view.vaultLines || []).map((l) => resultRow(L117[3], text(l.key, l.vars || {}))),
  ];
  const done = el('button', { type: 'button', class: 'btn btn-primary btn-main', onclick: () => app.home() }, raw('L02'));
  let inverse = false;
  if (view.kind === 'checkpoint') {
    parts.push(el('p', { class: 'finish-big' }, raw(view.passed ? 'L111' : 'L118')),
      el('p', { class: 'finish-target num' }, text('S171', { value: fmtValue(t, t.target) })),
      el('div', { class: 'result-rows' }, resultRow(L117[0], text('S172', { exp: view.exp })), ...common()),
      ...congrats());
  } else if (view.passed) {
    inverse = true;
    parts.push(el('p', { class: 'muted small' }, t.name),
      el('p', { class: 'finish-big' }, view.star ? text('S28', { count: view.star }) : text('L48', { rank: t.rank })),
      ladderFill(t.rank, view.gained || []),
      el('p', { class: 'num' }, text('S202', { value: fmtValue(t, view.challengeValue) })),
      (view.gained || []).length > 1 ? el('p', { class: 'num' }, text('S203', { ranks: view.gained.join(', ') })) : null,
      el('div', { class: 'result-rows' },
        view.manaGained > 0 ? resultRow(L117[2], text('S176', { m: view.manaGained, n: view.manaTotal })) : null,
        view.slots ? el('p', { class: 'result-line' }, text('S204', view.slots)) : null,
        view.vaultUnlocked ? el('button', { type: 'button', class: 'line-tap', onclick: () => app.tab('world') }, text('S183')) : null,
        ...common()),
      ...congrats(),
      view.preview ? el('p', { class: 'muted small' }, text(view.preview.key, view.preview.vars)) : null,
      el('div', { class: 'stack full-bottom' },
        view.star ? null : el('button', { type: 'button', class: 'btn', onclick: () => shareRankCard(t, view) }, raw('L124')),
        done));
  } else {
    parts.push(el('p', { class: 'finish-big' }, text('S205')),
      el('p', {}, text('S206')),
      el('div', { class: 'result-rows' },
        el('p', { class: 'result-line' }, text('S207')),
        resultRow(L117[0], text('S172', { exp: view.exp })),
        ...common()),
      el('p', { class: 'muted small' }, text('S208')),
      el('p', { class: 'muted small' }, text('S209')));
  }
  if (!(view.passed && view.kind === 'challenge')) parts.push(el('div', { class: 'full-bottom' }, done));
  mount(root, el('section', { class: `full finish-body fade-in${inverse ? ' inverse' : ''}` }, parts));
}

/** E -> S ladder that fills the newly reached ranks one by one (3.3: 150 ms each). */
function ladderFill(rank, gained) {
  const at = CONFIG.ranks.indexOf(rank);
  return el('span', { class: 'ladder ladder-big', role: 'img', 'aria-label': CONFIG.ranks.slice(0, at + 1).join(' ') },
    CONFIG.ranks.map((r, i) => {
      const fresh = gained.includes(r);
      const step = el('span', { class: `ladder-step${i <= at ? ' on' : ''}${i === at ? ' now' : ''}${fresh ? ' fill-in' : ''}` },
        el('span', { class: 'ladder-dot' }), el('span', { class: 'ladder-letter small' }, r));
      if (fresh) step.style.animationDelay = `${gained.indexOf(r) * 150}ms`;
      return step;
    }));
}

// ---- Rank-up card (7.3): 1080x1350, inverted colors, thin frame ----

function wrapLines(ctx, s, max) {
  const words = String(s).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryLine).width > max && line) {
      lines.push(line);
      line = w;
    } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawRankCard(t, view) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, c.width - 96, c.height - 96);
  ctx.fillStyle = '#000000';
  const font = '-apple-system, "SF Pro Text", system-ui, sans-serif';
  ctx.font = `600 64px ${font}`;
  let y = 260;
  for (const line of wrapLines(ctx, t.name, 880)) {
    ctx.fillText(line, 110, y);
    y += 80;
  }
  ctx.font = `700 104px ${font}`;
  y += 120;
  ctx.fillText(`${text('L48', { rank: view.rankOld })} → ${text('L48', { rank: t.rank })}`, 110, y);
  ctx.font = `400 52px ${font}`;
  y += 140;
  for (const line of wrapLines(ctx, `${t.focus} · ${fmtValue(t, view.challengeValue)}`, 860)) {
    ctx.fillText(line, 110, y);
    y += 68;
  }
  ctx.fillStyle = '#595959';
  ctx.font = `400 36px ${font}`;
  ctx.fillText(raw('L74'), 110, c.height - 110);
  return c;
}

async function shareRankCard(t, view) {
  const canvas = drawRankCard(t, view);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const words = plain(text('S25', { talent: t.name, rank: t.rank, value: fmtValue(t, view.challengeValue) }));
  const file = new File([blob], `${raw('L74')}-rank-${t.rank}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: words });
      return;
    } catch {
      return; // closed by the user
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
}
