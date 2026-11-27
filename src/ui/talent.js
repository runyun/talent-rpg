// Talent page and its pages (spec 5.8; part of the Talents tab).
// Stage 10A: focus, checks, records (Needs work, Challenges, Fixed, Old recordings), schedule,
// role, rename and delete. Target & step, challenge entries and plateau notes come in stage 10B.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { dateKey, fmtDateKey, monthDay, weekdayLabel } from '../time.js';
import { fmtStep, fmtValue } from '../format.js';
import {
  state, talentById, saveTalent, deleteTalent, applyUpdates, deleteMedia, addMetric, newId,
} from '../store.js';
import { dirOf, shownTarget } from '../model/practice.js';
import { roleAllowed, roleChange, slotUse } from '../model/roles.js';
import {
  backButton, group, navRow, rankLadder, roleTag, segmented, confirmDeleteButton, swipeRow,
  onLongPress, openSheet, closeSheet, textInput,
} from './widgets.js';
import {
  slotGroups, slotGroupSheet, addSlotsSheet, textSheet,
} from './sheets.js';
import { app } from './app.js';

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

function pageTop() {
  return el('div', { class: 'page-top' }, backButton(() => app.back()));
}

/** Old trial records with a value (shown in Challenges, spec 4.6). */
function oldTrials(talentId) {
  return state.trials.filter((r) => r.talentId === talentId && isNum(r.value));
}

function oldRecordings(talentId) {
  return state.media.filter((m) => m.talentId === talentId);
}

// ---- Talent page ----

export function renderTalent(root, talentId) {
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
    navRow(L128[2], String((t.checks || []).length), () => checksSheet(t, rerender)),
  ];

  const records = [
    navRow(L128[3], String((t.needsWork || []).length), () => app.needsWork(t.id)),
    navRow(L128[4], String(oldTrials(t.id).length), () => app.talentPage(t.id, 'challenges')),
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
  const roles = ['main', 'maintain', 'dormant'];
  const roleSeg = segmented(roles.map((r) => ({
    value: r, label: raw({ main: 'L45', maintain: 'L46', dormant: 'L47' }[r]), disabled: !roleAllowed(state, t.id, r),
  })), t.role, async (role) => {
    if (role === t.role) return;
    await applyUpdates({ talents: roleChange(state, t.id, role) });
    rerender();
  }, {
    onDisabled: () => {
      limitNote.textContent = text('L56', { count: slotUse(state, t.id).slots });
      limitNote.hidden = false;
    },
  });

  mount(root, el('section', { class: 'page fade-in' },
    pageTop(),
    el('div', { class: 'page-head' }, el('h1', { class: 'page-title' }, t.name), roleTag(t.role)),
    rankLadder(t.rank),
    el('div', { class: 'target-row' },
      el('div', {}, el('span', { class: 'part-label small muted' }, raw('L97')), el('span', { class: 'target-mid num' }, target || '')),
      goalStep ? el('span', { class: 'muted small num' }, goalStep) : null),
    group(L127[0], practice),
    group(L127[1], records),
    group(L127[2], schedule),
    el('section', { class: 'group' }, el('h2', { class: 'group-title' }, L127[3]), roleSeg.node, limitNote),
    el('div', { class: 'stack page-end' },
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => textSheet({
          title: raw('L18'),
          value: t.name,
          maxlength: 60,
          onSave: async (v) => {
            await saveTalent({ ...talentById(t.id), name: v });
            rerender();
          },
        }),
      }, raw('L18')),
      confirmDeleteButton(async () => {
        await deleteTalent(t.id);
        app.tab('talents');
      }))));
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
    const rows = oldTrials(t.id).slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map((r) => el('div', { class: 'row' },
      el('span', { class: 'row-label num' }, text('S283', { date: fmtDateKey(r.date), value: fmtValue(t, r.value) }))));
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
