// Rank-up card image (spec 7.3): talent, old rank -> new rank, main metric old -> new.
// Drawn on a canvas in the colors of the (inverted) rank-up screen; saved or shared as a PNG.

import { el } from '../dom.js';
import { text, raw } from '../text.js';
import { METRICS } from '../model/trials.js';

const W = 1080;
const H = 1350;
const PAD = 96;

function themeVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Split text into lines that fit maxWidth with the current canvas font. */
function wrap(ctx, s, maxWidth) {
  const words = String(s).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(tryLine).width <= maxWidth || !line) line = tryLine;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  // A single word longer than the width (e.g. CJK text without spaces): break by character.
  return lines.flatMap((l) => {
    if (ctx.measureText(l).width <= maxWidth) return [l];
    const out = [];
    let cur = '';
    for (const ch of l) {
      if (ctx.measureText(cur + ch).width > maxWidth && cur) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  });
}

/**
 * The lines on the card. Every word comes from the copy file (L48, L51, L74) or the user's data.
 * card = { talent, oldRank, newRank, metric, oldValue, newValue }
 */
export function cardLines(card) {
  const metricLabel = raw('L51')[METRICS.indexOf(card.metric)];
  const values = [card.oldValue, card.newValue].filter((v) => v !== null && v !== undefined);
  return {
    talent: card.talent,
    rank: `${text('L48', { rank: card.oldRank })} → ${text('L48', { rank: card.newRank })}`,
    metric: values.length === 2 && metricLabel ? `${metricLabel}: ${card.oldValue} → ${card.newValue}` : null,
    footer: raw('L74'),
  };
}

export function drawRankCard(card) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const bg = themeVar('--accent-bg', '#ffffff');
  const fg = themeVar('--accent-fg', '#000000');
  const muted = themeVar('--muted-inverse', '#595959');
  const font = themeVar('--font', 'system-ui, sans-serif');
  const mono = themeVar('--font-mono', 'ui-monospace, monospace');
  const lines = cardLines(card);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(PAD / 2, PAD / 2, W - PAD, H - PAD);
  ctx.textBaseline = 'top';
  ctx.fillStyle = fg;

  let y = PAD * 2;
  ctx.font = `600 72px ${font}`;
  for (const l of wrap(ctx, lines.talent, W - PAD * 3).slice(0, 3)) {
    ctx.fillText(l, PAD * 1.5, y);
    y += 92;
  }
  y += 80;
  // The rank line stays on one line when it can: shrink from 120px down to 72px.
  let size = 120;
  ctx.font = `700 ${size}px ${mono}`;
  while (size > 72 && ctx.measureText(lines.rank).width > W - PAD * 3) {
    size -= 4;
    ctx.font = `700 ${size}px ${mono}`;
  }
  for (const l of wrap(ctx, lines.rank, W - PAD * 3)) {
    ctx.fillText(l, PAD * 1.5, y);
    y += Math.round(size * 1.25);
  }
  if (lines.metric) {
    y += 40;
    ctx.font = `400 56px ${mono}`;
    for (const l of wrap(ctx, lines.metric, W - PAD * 3).slice(0, 4)) {
      ctx.fillText(l, PAD * 1.5, y);
      y += 72;
    }
  }
  ctx.fillStyle = muted;
  ctx.font = `400 40px ${font}`;
  ctx.textBaseline = 'bottom';
  ctx.fillText(lines.footer, PAD * 1.5, H - PAD * 1.5);
  return canvas;
}

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

/** Share sheet with the PNG (on iPhone it has "Save Image"); falls back to a download. */
async function sharePng(blob, shareText) {
  const file = new File([blob], 'rank-up.png', { type: 'image/png' });
  const data = shareText ? { files: [file], text: shareText } : { files: [file] };
  if (navigator.canShare && navigator.canShare(data)) {
    try {
      await navigator.share(data);
    } catch {
      // cancelled
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: 'rank-up.png', hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
}

/** Preview of the card with L29 (Save image) and L30 (Share). shareText is the S25 line. */
export function rankCardBlock(card, shareText) {
  const canvas = drawRankCard(card);
  const img = el('img', { class: 'rank-card-preview', alt: shareText, src: canvas.toDataURL('image/png') });
  // Make the PNG now: the share sheet must open directly from the tap (iOS user activation).
  let blob = null;
  const ready = toBlob(canvas).then((b) => { blob = b; return b; });
  const go = (withText) => () => (blob ? sharePng(blob, withText) : ready.then((b) => sharePng(b, withText)));
  return el('div', { class: 'stack' },
    img,
    el('div', { class: 'inline' },
      el('button', { type: 'button', class: 'btn', onclick: go(null) }, raw('L29')),
      el('button', { type: 'button', class: 'btn', onclick: go(shareText) }, raw('L30'))));
}
