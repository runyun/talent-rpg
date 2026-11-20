// Companions: feed (spec 5.2 item 4, 7.11), profile page (5.9), first meeting (5.7 step 4)
// and congratulations (7.10). Nothing here appears in the focus area of Home.

import { el, mount } from '../dom.js';
import { text, raw, congrats } from '../text.js';
import { dateKey, fromDateKey, hm, addDays, weekdayLabel, isoWeekday } from '../time.js';
import { COMPANIONS } from '../data/companions.js';
import { state, savePlayer } from '../store.js';
import { selectFeed, congratulators, lastSevenDays } from '../model/companionSim.js';
import { backButton } from './widgets.js';
import { app } from './app.js';

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function companionById(id) {
  return COMPANIONS[id - 1];
}

export function companionsOn() {
  return !state.settings || state.settings.companionsOn !== false;
}

/** The sentence of a feed item. */
export function feedLine(item) {
  if (item.type === 'you') return text(item.key, item.vars || {});
  const c = item.companionId ? companionById(item.companionId) : null;
  const vars = { ...(item.vars || {}), name: c && c.title, talent: c && c.talent };
  return text(item.key, vars, item.variant || 0);
}

// ---- Feed ----

export function renderFeedSection() {
  if (!companionsOn() || !state.world) return null;
  const now = new Date();
  const labels = raw('L66');
  const days = [];
  for (let i = 0; i <= 7; i += 1) {
    const day = dateKey(addDays(now, -i));
    let items = state.feed.filter((x) => x.date === day);
    if (i === 0) items = items.filter((x) => x.time <= hm(now)); // nothing from later today
    const picked = selectFeed(items, day);
    if (!picked.length) continue;
    const heading = i === 0 ? labels[0] : i === 1 ? labels[1] : monthDay.format(fromDateKey(day));
    days.push(el('div', { class: 'feed-day' },
      el('p', { class: 'muted small' }, heading),
      ...picked.map((it) => {
        const line = el('span', {}, feedLine(it));
        const time = it.type === 'practice' || it.type === 'rankUp' ? el('span', { class: 'num muted small' }, it.time) : null;
        if (it.companionId) {
          return el('button', { type: 'button', class: 'feed-item', onclick: () => app.companion(it.companionId) }, time, line);
        }
        return el('div', { class: 'feed-item' }, time, line);
      })));
  }
  return el('section', { class: 'section' },
    el('h2', { class: 'section-title' }, raw('L60')[2]),
    ...days);
}

// ---- Profile ----

export function renderCompanion(root, id) {
  const c = companionById(id);
  const s = state.world && state.world.companions[id - 1];
  if (!c || !s) {
    app.home();
    return;
  }
  const L65 = raw('L65');
  const today = dateKey(new Date());
  const ev = s.event && today >= s.event.start && today < s.event.end ? s.event : null;
  const week = lastSevenDays(id, state.feed, today);
  const row = (label, value) => el('div', { class: 'profile-row' }, el('span', { class: 'muted small' }, label), el('span', {}, value));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('p', { class: 'muted small' }, text('S53')),
    el('h1', { class: 'page-title' }, c.title),
    row(L65[0], c.talent),
    row(L65[1], c.personality),
    row(L65[2], text('L48', { rank: s.rank })),
    row(L65[3], `${Math.round(c.attendance * 100)}%`),
    row(L65[4], c.preferredTime),
    ev ? row(L65[5], text(ev.key, { name: c.title, talent: c.talent }, 0)) : null,
    el('div', { class: 'profile-row' },
      el('span', { class: 'muted small' }, L65[6]),
      el('div', { class: 'week-dots' }, week.map((d) => el('span', { class: `week-dot${d.practiced ? ' on' : ''}` },
        el('span', { class: 'small muted' }, weekdayLabel(isoWeekday(fromDateKey(d.day)))),
        el('span', { class: 'num' }, d.practiced ? '✓' : '·')))))));
}

// ---- First meeting (C5) ----

const FIRST_THREE = [1, 2, 3];

export function needsGreeting() {
  return companionsOn() && state.player.onboardingDone && !state.player.companionsGreeted;
}

export function renderGreeting(root) {
  const lines = FIRST_THREE.map((id) => {
    const c = companionById(id);
    return el('div', { class: 'congrats-item' },
      el('span', { class: 'muted small' }, c.title),
      el('span', {}, congrats('C5', c.tone, { companionTalent: c.talent })));
  });
  const node = el('section', { class: 'finish fade-in' },
    el('div', { class: 'stack' }, ...lines),
    el('p', { class: 'muted small' }, text('S49')));
  node.addEventListener('click', async () => {
    await savePlayer({ ...state.player, companionsGreeted: true });
    app.home();
  }, { once: true });
  mount(root, node);
}

// ---- Congratulations block ----

/** 1-3 companions congratulate. kind: C1-C4. Returns a node or null. */
export function congratsBlock(kind, seedText, vars) {
  if (!companionsOn() || !state.world) return null;
  const today = dateKey(new Date());
  const who = congratulators(`${seedText}|${kind}`, state.feed.filter((x) => x.date === today), state.world);
  if (!who.length) return null;
  return el('div', { class: 'stack congrats' }, who.map((c) => el('div', { class: 'congrats-item' },
    el('span', { class: 'muted small' }, c.title),
    el('span', {}, congrats(kind, c.tone, vars)))));
}
