// Capturing and playing records (spec 2: MediaRecorder, camera file picker, pasted text; 4.8).
// Record object: { id, talentId, date, type, media: 'audio'|'photo'|'text', blob, text, mime, durationSec, createdAt }

import { el } from '../dom.js';
import { raw } from '../text.js';
import { dateKey } from '../time.js';
import { newId } from '../store.js';

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  return types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}

function baseRecord(talentId, type) {
  const now = Date.now();
  return { id: newId(), talentId, date: dateKey(new Date(now)), type, createdAt: now };
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Capture controls: Record / Take photo / Paste text.
 * onCaptured(record) fires each time something is captured (the newest one wins).
 * Returns { node, stop() } — stop() ends a running recording (e.g. when the measured run ends).
 */
export function captureControls({ talentId, type, maxSec = null, onCaptured, onRecordingChange }) {
  let recorder = null;
  let stream = null;
  let startedAt = 0;
  let tick = null;
  let chunks = [];

  const elapsed = el('span', { class: 'num muted', hidden: true });
  const recBtn = el('button', { type: 'button', class: 'btn' }, raw('L24'));
  const photoInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const photoBtn = el('button', { type: 'button', class: 'btn' }, raw('L26'));
  const textBtn = el('button', { type: 'button', class: 'btn' }, raw('L27'));
  const textArea = el('textarea', { rows: '4', hidden: true });
  const textSave = el('button', { type: 'button', class: 'btn', hidden: true }, raw('L21'));

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') recBtn.hidden = true;

  const setRecording = (on) => {
    recBtn.textContent = raw(on ? 'L25' : 'L24');
    recBtn.classList.toggle('btn-primary', on);
    elapsed.hidden = !on;
    photoBtn.disabled = on;
    textBtn.disabled = on;
    if (onRecordingChange) onRecordingChange(on);
  };

  async function startRec() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      recBtn.hidden = true; // microphone refused: photo and text still work
      return;
    }
    const mime = pickMime();
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      const blobType = recorder.mimeType || mime || 'audio/mp4';
      const blob = new Blob(chunks, { type: blobType });
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      recorder = null;
      clearInterval(tick);
      setRecording(false);
      if (blob.size) onCaptured({ ...baseRecord(talentId, type), media: 'audio', blob, mime: blobType, durationSec, text: '' });
    };
    startedAt = Date.now();
    recorder.start(1000);
    setRecording(true);
    elapsed.textContent = fmt(0);
    tick = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      elapsed.textContent = fmt(s);
      if (maxSec && s >= maxSec) stopRec();
    }, 250);
  }

  function stopRec() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  recBtn.addEventListener('click', () => (recorder ? stopRec() : startRec()));
  photoBtn.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    onCaptured({ ...baseRecord(talentId, type), media: 'photo', blob: file, mime: file.type || 'image/jpeg', durationSec: null, text: '' });
    photoInput.value = '';
  });
  textBtn.addEventListener('click', () => {
    textArea.hidden = false;
    textSave.hidden = false;
    textArea.focus();
  });
  textSave.addEventListener('click', () => {
    const value = textArea.value.trim();
    if (!value) return;
    textArea.hidden = true;
    textSave.hidden = true;
    onCaptured({ ...baseRecord(talentId, type), media: 'text', blob: null, mime: 'text/plain', durationSec: null, text: value });
  });

  const node = el('div', { class: 'stack' },
    el('div', { class: 'inline' }, recBtn, elapsed),
    el('div', { class: 'inline' }, photoBtn, textBtn),
    photoInput, textArea, textSave);
  return { node, stop: stopRec };
}

// ---- Playback ----

let playing = null; // only one sound at a time

function stopPlaying() {
  if (playing) {
    playing.audio.pause();
    playing.button.textContent = raw('L23');
    playing = null;
  }
}

/** A record shown for playback: audio Play/Stop button, photo, or text. */
export function mediaView(record, { label = null } = {}) {
  if (!record) return null;
  if (record.media === 'text') {
    return el('div', { class: 'media-view' }, label ? el('span', { class: 'muted small' }, label) : null, el('p', { class: 'media-text' }, record.text));
  }
  if (record.media === 'photo') {
    const img = el('img', { class: 'media-photo', alt: '' });
    img.src = URL.createObjectURL(record.blob);
    return el('div', { class: 'media-view' }, label ? el('span', { class: 'muted small' }, label) : null, img);
  }
  const button = el('button', { type: 'button', class: 'btn' }, raw('L23'));
  button.addEventListener('click', () => {
    if (playing && playing.button === button) {
      stopPlaying();
      return;
    }
    stopPlaying();
    const audio = new Audio(URL.createObjectURL(record.blob));
    audio.addEventListener('ended', () => {
      if (playing && playing.audio === audio) stopPlaying();
    });
    playing = { audio, button };
    button.textContent = raw('L25');
    audio.play().catch(() => stopPlaying());
  });
  return el('div', { class: 'media-view' },
    label ? el('span', { class: 'muted small' }, label) : null,
    el('div', { class: 'inline' }, button, record.durationSec ? el('span', { class: 'num muted small' }, fmt(record.durationSec)) : null));
}

export function isPlaying() {
  return playing !== null;
}

export { stopPlaying };
