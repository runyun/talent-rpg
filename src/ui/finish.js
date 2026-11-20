// Finish screen (spec 5.4): difficulty answer, then results in order, then back home.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import {
  state, attrsOf, talentById, commitSession, clearActive, saveAttribute, updateOpenMetric,
} from '../store.js';
import { finishSession } from '../model/session.js';
import { replaceMaterial } from '../model/knobs.js';
import { textInput } from './widgets.js';
import { evidencePrompt } from './timer.js';
import { app } from './app.js';

const STAGGER_MS = 300; // each line fades in after the previous one
const STAY_MS = 2000; // last line stays 2 s, then home

let leaveTimer = null;

function leave() {
  clearTimeout(leaveTimer);
  leaveTimer = null;
  app.home();
}

export async function renderFinish(root, active) {
  clearTimeout(leaveTimer);
  const talent = talentById(active.talentId);
  const attr = talent && attrsOf(talent.id)[active.attributeIndex];
  if (!talent || !attr) {
    await clearActive();
    app.home();
    return;
  }

  if (active.size === 'mini') {
    await complete(root, active, attr, null);
    return;
  }

  const seen = (state.player.seenExplanations || []).includes('S62');
  const answers = [['tooEasy', 'L04'], ['justRight', 'L05'], ['tooHard', 'L06']];
  mount(root, el('section', { class: 'finish fade-in' },
    seen ? null : el('p', { class: 'muted small' }, text('S62')),
    el('div', { class: 'focus-bottom' }, answers.map(([value, key]) => el('button', {
      type: 'button',
      class: 'btn btn-big',
      onclick: (e) => {
        e.currentTarget.disabled = true;
        complete(root, active, attr, value);
      },
    }, raw(key))))));
}

async function complete(root, active, attr, feedback) {
  const now = new Date();
  const out = finishSession({ active, feedback, state, attr, now });
  if (feedback) {
    const seen = new Set(out.player.seenExplanations || []);
    seen.add('S62');
    out.player.seenExplanations = [...seen];
  }
  await commitSession(out);
  updateOpenMetric({ practiced: true });
  showResults(root, out);
}

function showResults(root, out) {
  const box = el('section', { class: 'finish results' });
  mount(root, box);
  let pending = 0; // prompts still waiting for an answer

  const promptDone = () => {
    pending -= 1;
    if (pending === 0) leaveTimer = setTimeout(leave, STAY_MS);
  };

  out.results.forEach((r, i) => {
    if (r.evidencePrompt) {
      pending += 1;
      const node = evidencePrompt({ talentId: out.session.talentId, sessionId: out.session.id, onDone: promptDone });
      node.classList.add('fade-in');
      node.style.animationDelay = `${i * STAGGER_MS}ms`;
      box.append(node);
      return;
    }
    const line = el('p', { class: i === 0 ? 'task fade-in' : 'fade-in' }, text(r.key, r.vars || {}));
    line.style.animationDelay = `${i * STAGGER_MS}ms`;
    box.append(line);
    if (r.materialPrompt) {
      pending += 1;
      box.append(materialPrompt(out.attr, i * STAGGER_MS, promptDone));
    }
  });

  if (pending === 0) {
    box.addEventListener('click', leave);
    leaveTimer = setTimeout(leave, (out.results.length - 1) * STAGGER_MS + STAY_MS);
  }
}

/** S16: type a new material, or keep the current one (L08). */
function materialPrompt(attr, delay, onDone) {
  const input = textInput('', { maxlength: 120 });
  const save = el('button', {
    type: 'button',
    class: 'btn btn-primary',
    onclick: async () => {
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      await saveAttribute(replaceMaterial(attr, value, Date.now()));
      node.replaceChildren(el('p', {}, value));
      onDone();
    },
  }, raw('L21'));
  const keep = el('button', {
    type: 'button',
    class: 'btn',
    onclick: async () => {
      await saveAttribute({ ...attr, targetPromptOff: true });
      node.replaceChildren();
      onDone();
    },
  }, raw('L08'));
  const node = el('div', { class: 'stack fade-in' }, input, save, keep);
  node.style.animationDelay = `${delay}ms`;
  return node;
}
