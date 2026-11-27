// Number and value display (spec section 2 and 6.2).
// Thousands with commas (1,234); at most 1 decimal without trailing zeros (2.5, 3);
// talents with Whole numbers always show integers. A value is "number + space + unit".

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function fmtNumber(v, wholeNumbers = false) {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return null;
  return (wholeNumbers ? whole : oneDecimal).format(Number(v));
}

/** "100 BPM", or "100" when the unit is empty; null when there is no number. */
export function fmtValue(talent, v) {
  const n = fmtNumber(v, talent && talent.wholeNumbers);
  if (n === null) return null;
  const unit = talent && talent.unit ? String(talent.unit).trim() : '';
  return unit ? `${n} ${unit}` : n;
}

/** {step}: "+4 BPM" when more is better, "−4 BPM" when less is better. */
export function fmtStep(talent, step, dir) {
  const n = fmtNumber(step, talent && talent.wholeNumbers);
  if (n === null) return null;
  const unit = talent && talent.unit ? String(talent.unit).trim() : '';
  const sign = dir < 0 ? '−' : '+';
  return unit ? `${sign}${n} ${unit}` : `${sign}${n}`;
}

/** Parse a number typed by the user ("1,200" or "2.5"); null when it is not a number. */
export function parseNumber(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(/,/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
