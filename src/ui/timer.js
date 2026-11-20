// Timer screen (spec 5.3). Time is computed from the start time, so leaving the app is fine.
// The screen stays on (Wake Lock) where supported.
// Deep cool-down offers a 30-sec record (S19) or Skip.

import { el, mount } from '../dom.js';
import { text, raw } from '../text.js';
import { CONFIG } from '../config.js';
import { clearActive, saveActive, saveEvidence } from '../store.js';
import { currentPhase } from '../model/session.js';
import { startMetronome, stopMetronome, setBpm } from '../metronome.js';
import { keepAwake, releaseAwake } from '../wakelock.js';
import { captureControls, mediaView } from './media.js';
import { app } from './app.js';

let tick = null;
let metronomeOn = true;

export function stopTimer() {
  clearInterval(tick);
  tick = null;
  stopMetronome();
  releaseAwake();
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** S19 with Record / Take photo / Paste text, or Skip. onDone(record|null). */
export function evidencePrompt({ talentId, sessionId, onDone }) {
  const box = el('div', { class: 'stack' });
  const capture = captureControls({
    talentId,
    type: 'evidence30s',
    maxSec: CONFIG.evidence.seconds,
    onCaptured: async (record) => {
      await saveEvidence(record, sessionId, CONFIG.evidence.keepPerTalent);
      box.replaceChildren(mediaView(record));
      onDone(record);
    },
  });
  const skip = el('button', {
    type: 'button',
    class: 'btn-text',
    onclick: () => {
      capture.stop();
      box.replaceChildren();
      onDone(null);
    },
  }, raw('L15'));
  box.append(el('p', { class: 'small' }, text('S19')), capture.node, skip);
  return box;
}

export function renderTimer(root, active) {
  stopTimer();
  metronomeOn = true;
  const phaseNames = raw('L44');

  const phaseLabel = el('p', { class: 'muted small timer-phase' });
  const task = el('p', { class: 'timer-task' });
  const clock = el('p', { class: 'timer-clock num' });
  const metroValue = el('span', { class: 'num' });
  const metroToggle = el('button', { type: 'button', class: 'seg-btn' });
  const metro = el('div', { class: 'metro', hidden: true },
    el('span', {}, raw('L38')), metroValue, metroToggle);
  const extra = el('div', {});

  let finished = false;
  const finish = async (endedAt) => {
    if (finished) return;
    finished = true;
    stopTimer();
    const done = { ...active, status: 'finished', endedAt };
    await saveActive(done);
    app.finish(done);
  };

  metroToggle.addEventListener('click', () => {
    metronomeOn = !metronomeOn;
    update();
  });

  const cancel = el('button', {
    type: 'button',
    class: 'btn-text small timer-cancel',
    onclick: async () => {
      stopTimer();
      await clearActive();
      app.home();
    },
  }, raw('L03'));

  const doneBtn = el('button', {
    type: 'button',
    class: 'btn btn-primary btn-start',
    onclick: () => finish(Math.min(Date.now(), active.endsAt)),
  }, raw('L02'));

  let shownPhase = -1;
  function update() {
    const now = Date.now();
    if (now >= active.endsAt) {
      finish(active.endsAt);
      return;
    }
    const cur = currentPhase(active, now);
    if (cur.index !== shownPhase) {
      shownPhase = cur.index;
      phaseLabel.textContent = cur.phase.phase === null ? '' : phaseNames[cur.phase.phase];
      // Cool-down keeps the main task on screen.
      task.textContent = cur.phase.task || (active.phases[1] && active.phases[1].task) || '';
      if (cur.phase.phase === 2 && !active.evidenceId && !active.evidenceSkipped) {
        extra.replaceChildren(evidencePrompt({
          talentId: active.talentId,
          sessionId: active.id,
          onDone: (record) => {
            if (record) active.evidenceId = record.id;
            else active.evidenceSkipped = true;
            saveActive(active);
          },
        }));
      }
    }
    clock.textContent = fmtClock(active.endsAt - now);

    const { bpm } = cur.phase;
    metro.hidden = !bpm;
    if (bpm) {
      metroValue.textContent = `${bpm} ${raw('L52')[0]}`;
      metroToggle.textContent = raw('L39')[metronomeOn ? 0 : 1];
      metroToggle.classList.toggle('on', metronomeOn);
      if (metronomeOn) {
        setBpm(bpm);
        startMetronome(bpm);
      } else {
        stopMetronome();
      }
    } else {
      stopMetronome();
    }
  }

  mount(root, el('section', { class: 'timer fade-in' },
    el('div', { class: 'timer-top' }, cancel, phaseLabel),
    task,
    clock,
    metro,
    extra,
    el('div', { class: 'focus-bottom' }, doneBtn)));

  update();
  if (Date.now() < active.endsAt) {
    tick = setInterval(update, 250);
    keepAwake();
  }
}
