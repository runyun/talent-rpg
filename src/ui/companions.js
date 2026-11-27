// Companions: feed (spec 5.2 item 4, 7.11), profile page (5.9), first meeting (5.7 step 4)
// and congratulations (7.10). Nothing here appears in the focus area of Home.

import { el, mount } from '../dom.js';
import { text, raw, congrats } from '../text.js';
import {
  dateKey, fromDateKey, hm, addDays, dayLabel, fmtDateKey,
} from '../time.js';
import { COMPANIONS } from '../data/companions.js';
import { state, savePlayer } from '../store.js';
import { CONFIG } from '../config.js';
import { STORIES } from '../data/stories.js';
import { selectFeed, congratulators } from '../model/companionSim.js';
import { backButton, openSheet, closeSheet } from './widgets.js';
import { app } from './app.js';

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
  for (let i = 0; i <= 1; i += 1) {
    const day = dateKey(addDays(now, -i));
    let items = state.feed.filter((x) => x.date === day);
    if (i === 0) items = items.filter((x) => x.time <= hm(now)); // nothing from later today
    const picked = selectFeed(items, day);
    if (!picked.length) continue;
    const heading = labels[i];
    days.push(el('section', { class: 'group' },
      el('h2', { class: 'group-title' }, heading),
      el('div', { class: 'group-card' }, picked.map((it) => {
        const line = el('span', { class: 'row-label' }, feedLine(it));
        const time = it.type === 'practice' || it.type === 'rankUp' ? el('span', { class: 'row-sub num muted small' }, it.time) : null;
        if (it.companionId) {
          return el('button', { type: 'button', class: 'row row-tap feed-item', onclick: () => app.companion(it.companionId) }, el('span', { class: 'row-main' }, line, time));
        }
        return el('div', { class: 'row feed-item' }, el('span', { class: 'row-main' }, line, time));
      }))));
  }
  return el('div', { class: 'feed' },
    ...days);
}

// ---- Profile ----

export function renderCompanion(root, id) {
  const c = companionById(id);
  const s = state.world && state.world.companions[id - 1];
  if (!c || !s || s.joinedAt === null) {
    app.back();
    return;
  }
  const L65 = raw('L65');
  const L161 = raw('L161');
  const now = new Date();
  const today = dateKey(now);
  const owned = (state.player.owned && state.player.owned.stories) || [];
  const mana = state.player.mana || 0;
  const price = CONFIG.companions.storyPrice;
  const joined = s.joinedAt ? fromDateKey(s.joinedAt) : fromDateKey(today);
  const weeksTogether = Math.floor((fromDateKey(today) - joined) / (7 * 86400000));

  // Story (5.9): 3 chapters, open after 0 / 4 / 10 weeks together; 10 Mana each, read again for free.
  const chapters = STORIES[id - 1].map((ch, i) => {
    const key = `${id}-${i + 1}`;
    const head = el('span', { class: 'row-label' }, text('L161', { n: i + 1 }, 1));
    if (owned.includes(key)) {
      return el('button', { type: 'button', class: 'row row-tap', onclick: () => readSheet(c, i, ch) },
        el('span', { class: 'row-main' }, head, el('span', { class: 'row-sub muted small' }, ch.title)),
        el('span', { class: 'chev muted' }, '›'));
    }
    const need = CONFIG.companions.storyWeeks[i];
    if (weeksTogether < need) {
      return el('div', { class: 'row row-off' },
        el('span', { class: 'row-main' }, el('span', { class: 'row-label muted' }, text('L161', { n: i + 1 }, 1)), el('span', { class: 'row-sub muted small' }, text('S307', { n: need }))));
    }
    const enough = mana >= price;
    return el('div', { class: 'row' },
      el('span', { class: 'row-main' }, head,
        el('span', { class: 'row-sub muted small' }, enough ? text('S309') : text('S285', { n: price - mana }))),
      el('button', {
        type: 'button',
        class: 'btn-small',
        disabled: !enough || undefined,
        onclick: async () => {
          const p = state.player;
          if ((p.mana || 0) < price) return;
          await savePlayer({ ...p, mana: p.mana - price, owned: { ...p.owned, stories: [...((p.owned && p.owned.stories) || []), key] } });
          app.refresh(); // redraws the page (closing sheets), then the chapter opens
          readSheet(c, i, ch);
        },
      }, `${L161[2]} · ${text('S286', { price })}`));
  });

  // Recent: the last 14 days (one line a day) and rank-ups (4.10, 5.9).
  const recent = [];
  for (let i = 0; i < CONFIG.companions.recentDays; i += 1) {
    const day = dateKey(addDays(now, -i));
    if (s.joinedAt && day < s.joinedAt) break;
    let items = state.feed.filter((x) => x.date === day && x.companionId === id);
    if (i === 0) items = items.filter((x) => x.time <= hm(now));
    const pickOrder = ['rankUp', 'event', 'jackpot', 'breakthrough', 'return', 'practice'];
    const item = pickOrder.map((type) => items.find((x) => x.type === type)).find(Boolean);
    if (!item) continue;
    recent.push(el('div', { class: 'row' },
      el('span', { class: 'row-main' }, el('span', { class: 'row-label' }, feedLine(item)), el('span', { class: 'row-sub muted small num' }, dayLabel(fromDateKey(day), now)))));
  }
  const ranks = (s.rankLog || []).slice().reverse().map((r) => el('div', { class: 'row' },
    el('span', { class: 'row-label' }, text('L48', { rank: r.rank })), el('span', { class: 'row-value muted small num' }, fmtDateKey(r.date))));

  mount(root, el('section', { class: 'page fade-in' },
    el('div', { class: 'page-top' }, backButton(() => app.back())),
    el('p', { class: 'muted small' }, text('S53')),
    el('h1', { class: 'page-title' }, c.title),
    el('p', { class: 'muted' }, `${c.talent} · ${text('L48', { rank: s.rank })}`),
    el('div', { class: 'card' }, el('span', { class: 'part-label small muted' }, L65[2]), el('p', {}, c.personality)),
    el('section', { class: 'group' },
      el('div', { class: 'page-head-split group-title-row' }, el('h2', { class: 'group-title' }, L161[0]), el('span', { class: 'muted small' }, text('S267', { n: mana }))),
      el('div', { class: 'group-card' }, chapters)),
    el('section', { class: 'group' },
      el('h2', { class: 'group-title' }, L65[3]),
      recent.length || ranks.length ? el('div', { class: 'group-card' }, [...recent, ...ranks]) : null)));
}

/** Reading sheet (5.9). */
function readSheet(c, i, ch) {
  openSheet([
    el('p', { class: 'muted small' }, text('S308', { name: c.title, n: i + 1 })),
    el('h2', { class: 'sheet-title' }, ch.title),
    el('p', { class: 'story-text' }, ch.text),
    el('button', { type: 'button', class: 'btn btn-primary btn-main', onclick: () => closeSheet() }, raw('L02')),
  ]);
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
