// Local-time helpers. Everything uses the phone's local time; days switch at local midnight.
// Fixed formats (spec section 2): time 'HH:MM' (24 h), weekday Mon-Sun, weeks start on Monday.

import { raw } from './text.js';

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const pad2 = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for a local date. */
export function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Local midnight Date from 'YYYY-MM-DD'. */
export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Add calendar days (safe across daylight saving changes). */
export function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Monday = 1 ... Sunday = 7 */
export function isoWeekday(d) {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

/** Date key of the Monday that starts the week containing d. */
export function weekKey(d) {
  return dateKey(addDays(startOfDay(d), 1 - isoWeekday(d)));
}

export function addWeeks(key, n) {
  return dateKey(addDays(fromDateKey(key), 7 * n));
}

/** 'HH:MM' */
export function hm(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function minutesOf(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function hhmmFromMinutes(total) {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
}

/** Date at a local day key and 'HH:MM'. */
export function at(key, hhmm) {
  const d = fromDateKey(key);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** 'YYYY-MM-DDTHH:MM' local stamp (stored in slot overrides). */
export function localStamp(d) {
  return `${dateKey(d)}T${hm(d)}`;
}

export function fromLocalStamp(s) {
  const [k, t] = s.split('T');
  return at(k, t);
}

const monthDayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFmt = new Intl.DateTimeFormat('en-US', { month: 'long' });

/** 'Nov 19' (fixed format, spec section 2). */
export function monthDay(d) {
  return monthDayFmt.format(d);
}

/** 'November' */
export function monthName(d) {
  return monthFmt.format(d);
}

/** 'Nov 19' for a 'YYYY-MM-DD' key. */
export function fmtDateKey(key) {
  return monthDayFmt.format(fromDateKey(key));
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY);
}

/**
 * {day} (copy sheet variables): Today / Tomorrow / Yesterday / Mon-Sun.
 * 7 or more days ahead (the same weekday next week) or 7 or more days back: the date (Nov 27).
 */
export function dayLabel(d, now) {
  const labels = raw('L55');
  const diff = daysBetween(now, d);
  if (diff === 0) return labels[0];
  if (diff === 1) return labels[1];
  if (diff === -1) return labels[2];
  if (diff >= 7 || diff <= -7) return monthDay(d);
  return weekdayLabel(isoWeekday(d));
}

/** Mon-Sun label for weekday 1-7. */
export function weekdayLabel(weekday) {
  return raw('L55')[weekday + 2];
}

/** One-letter weekday (M T W T F S S), from L55. */
export function weekdayLetter(weekday) {
  return weekdayLabel(weekday).charAt(0);
}

export function sameDay(a, b) {
  return dateKey(a) === dateKey(b);
}
