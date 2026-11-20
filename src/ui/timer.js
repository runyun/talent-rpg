// Timer screen (spec 5.3). Time is computed from the start time, so leaving the app is fine.
// The screen stays on (Wake Lock) where supported.

import { el, mount } from '../dom.js';
import { raw } from '../text.js';
import { clearActive, saveActive } from '../store.js';
import { currentPhase } from '../model/session.js';
import { startMetronome, stopMetronome, setBpm } from '../metronome.js';
import { app } from './app.js';

let tick = null;
let wakeLock = null;
let metronomeOn = true;

async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    wakeLock = null; // not supported or refused: ignore
  }
}

function releaseAwake() {
  try {
    if (wakeLock) wakeLock.release();
  } catch {
    // ignore
  }
  wakeLock = null;
}

function onVisible() {
  if (!document.hidden && tick) {
    keepAwake();
  }
}

export function stopTimer() {
  clearInterval(tick);
  tick = null;
  stopMetronome();
  releaseAwake();
  document.removeEventListener('visibilitychange', onVisible);
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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
      const shown = cur.phase.task || (active.phases[1] && active.phases[1].task) || '';
      task.textContent = shown;
    }
    clock.textContent = fmt(active.endsAt - now);

    const bpm = cur.phase.bpm;
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
    el('div', { class: 'focus-bottom' }, doneBtn)));

  update();
  if (Date.now() < active.endsAt) {
    tick = setInterval(update, 250);
    keepAwake();
    document.addEventListener('visibilitychange', onVisible);
  }
}
