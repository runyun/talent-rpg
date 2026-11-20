// Calendar export (spec 7.12): one weekly repeating event per slot of every non-dormant talent.
// Times are floating local times (no time zone), like the rest of the app. No alarms.

import { text, raw } from '../text.js';
import { addDays, fromDateKey, weekKey } from '../time.js';

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const pad2 = (n) => String(n).padStart(2, '0');

/** Place code -> English label (L53); a custom place shows its own text. */
export function placeLabel(slot) {
  if (slot.place === 'custom') return slot.placeText || raw('L53')[3];
  const i = ['home', 'commute', 'work'].indexOf(slot.place);
  return i === -1 ? '' : raw('L53')[i];
}

/** Escape a TEXT value (RFC 5545 3.3.11). */
export function escapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold a content line to at most 75 octets per line (RFC 5545 3.1). */
export function foldLine(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // continuation lines start with a space
    if (curBytes + b > limit) {
      out.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const localStampIcs = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
const utcStampIcs = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Build the .ics text. Each event starts on this week's day of the slot (so the series
 * includes this week) and repeats every week on that day.
 */
export function buildIcs(state, now = new Date()) {
  const talents = new Map(state.talents.filter((t) => t.role !== 'dormant').map((t) => [t.id, t]));
  const monday = fromDateKey(weekKey(now));
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//talent-rpg//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const slots = state.slots
    .filter((s) => talents.has(s.talentId))
    .sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
  for (const slot of slots) {
    const talent = talents.get(slot.talentId);
    const start = addDays(monday, slot.weekday - 1);
    const [h, m] = slot.time.split(':').map(Number);
    start.setHours(h, m, 0, 0);
    const place = placeLabel(slot);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${slot.id}@talent-rpg`,
      `DTSTAMP:${utcStampIcs(now)}`,
      `DTSTART:${localStampIcs(start)}`,
      `DURATION:PT${slot.length}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[slot.weekday - 1]}`,
      `SUMMARY:${escapeText(text('S58', { talent: talent.name }))}`,
    );
    if (place) lines.push(`LOCATION:${escapeText(place)}`);
    lines.push('TRANSP:OPAQUE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
