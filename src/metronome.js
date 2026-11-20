// Metronome with Web Audio. Only sounds while the app is on screen (spec section 2).

let ctx = null;
let timer = null;
let nextAt = 0;
let bpm = 60;
let running = false;

/** Must be called from a tap (iOS only allows audio to start from a user gesture). */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    // A silent blip fully unlocks audio on iOS.
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.01);
  } catch {
    ctx = null;
  }
}

function click(time) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = 1000;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.6, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  o.connect(g).connect(ctx.destination);
  o.start(time);
  o.stop(time + 0.06);
}

function schedule() {
  const ahead = 0.12;
  while (nextAt < ctx.currentTime + ahead) {
    click(nextAt);
    nextAt += 60 / bpm;
  }
}

export function startMetronome(newBpm) {
  if (!ctx || !newBpm) return;
  bpm = newBpm;
  if (running) return;
  running = true;
  if (ctx.state === 'suspended') ctx.resume();
  nextAt = ctx.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}

export function setBpm(newBpm) {
  bpm = newBpm;
}

export function stopMetronome() {
  running = false;
  clearInterval(timer);
  timer = null;
}

export function isRunning() {
  return running;
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) {
    ctx.suspend();
  } else if (running) {
    ctx.resume();
    nextAt = ctx.currentTime + 0.1;
  }
});
