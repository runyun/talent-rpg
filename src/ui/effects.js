// Finish effects (spec 3.3, 5.13): the first part of the Passed screen. Black and white line
// drawings in the current text color; each plays once (every part <= 300 ms) and stops on its
// final picture. With Reduce Motion the final picture fades in (theme.css). Previews draw the
// final picture only (class "still").

import { svg } from '../dom.js';
import { raw } from '../text.js';

// Small helpers for SVG with per-element animation (CSS variables read by the keyframes).
const anim = (name, ms, delay = 0, vars = '') => `style="animation:${name} ${ms}ms ease-out ${delay}ms both;${vars}"`;

function rays(cx, cy, n, r0, r1, start = 0, delay = 0, ms = 200, name = 'fx-fade') {
  let out = '';
  for (let i = 0; i < n; i += 1) {
    const a = start + (i / n) * Math.PI * 2;
    const x0 = (cx + r0 * Math.cos(a)).toFixed(1);
    const y0 = (cy + r0 * Math.sin(a)).toFixed(1);
    const x1 = (cx + r1 * Math.cos(a)).toFixed(1);
    const y1 = (cy + r1 * Math.sin(a)).toFixed(1);
    out += `<path d="M${x0} ${y0}L${x1} ${y1}" ${anim(name, ms, delay, `--fx-dx:${((cx - x0) / 2).toFixed(1)}px;--fx-dy:${((cy - y0) / 2).toFixed(1)}px`)}/>`;
  }
  return out;
}

const CHECK = '<path class="fx-check" pathLength="1" d="M28 50l14 14 30-30"/>';

const EFFECTS = {
  check: () => `<path pathLength="1" d="M28 50l14 14 30-30" ${anim('fx-draw', 300)}/>`,
  stamp: () => `<g ${anim('fx-stamp', 220)}><g transform="rotate(-8 50 50)"><circle cx="50" cy="50" r="32"/><circle cx="50" cy="50" r="27"/><text x="50" y="54" text-anchor="middle" class="fx-text">${raw('L111').toUpperCase()}</text></g></g>`,
  sparks: () => `${CHECK}${rays(50, 50, 8, 32, 42, Math.PI / 8, 0, 300, 'fx-out')}`,
  stairs: () => `<path d="M14 82h16v-12h16v-12h16v-12h16v-12h12"/><circle cx="54" cy="52" r="5" class="fx-fill" ${anim('fx-hop', 300, 0, '--fx-dx:-16px;--fx-dy:12px')}/>`,
  flag: () => `<path d="M30 86V16M22 86h16"/><path d="M30 18h34l-8 9 8 9H30" class="fx-fill" ${anim('fx-move', 280, 0, '--fx-dx:0px;--fx-dy:50px')}/>`,
  confetti: () => {
    const shapes = [];
    for (let i = 0; i < 16; i += 1) {
      const a = Math.PI * (1.08 + (i / 15) * 0.84);
      const r = 22 + (i % 4) * 7;
      const x = 50 + r * Math.cos(a) * 1.3;
      const y = 62 + r * Math.sin(a);
      const fill = i % 2 ? 'fx-fill' : 'fx-gray';
      const v = `--fx-dx:${(50 - x).toFixed(1)}px;--fx-dy:${(92 - y).toFixed(1)}px;--fx-r:${(i * 47) % 90}deg`;
      const st = anim('fx-burst', 300, (i * 70) / 15, v);
      const k = i % 4;
      if (k === 0) shapes.push(`<rect x="${(x - 2.5).toFixed(1)}" y="${(y - 2.5).toFixed(1)}" width="5" height="5" class="${fill}" ${st}/>`);
      else if (k === 1) shapes.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.8" class="${fill}" ${st}/>`);
      else if (k === 2) shapes.push(`<rect x="${(x - 1).toFixed(1)}" y="${(y - 4).toFixed(1)}" width="2" height="8" class="${fill}" ${st}/>`);
      else shapes.push(`<path d="M${x.toFixed(1)} ${(y - 3).toFixed(1)}l3 5h-6z" class="${fill}" ${st}/>`);
    }
    return shapes.join('');
  },
  sprout: () => `<path d="M24 86h52"/><path pathLength="1" d="M50 86V46" ${anim('fx-draw', 180)}/><path d="M50 60c-14 0-20-10-18-18 10 0 18 6 18 18z" class="fx-fill" ${anim('fx-grow', 150, 180, '--fx-ox:50px;--fx-oy:60px')}/><path d="M50 52c14 0 20-10 18-18-10 0-18 6-18 18z" class="fx-fill" ${anim('fx-grow', 150, 330, '--fx-ox:50px;--fx-oy:52px')}/>`,
  dominoes: () => [0, 1, 2, 3, 4].map((i) => `<rect x="${16 + i * 14}" y="44" width="7" height="34" class="fx-fill" ${anim('fx-tip', 120, i * 45, `--fx-ox:${23 + i * 14}px;--fx-oy:78px`)}/>`).join('') + '<path d="M10 78h80"/>',
  'paper-plane': () => `<g ${anim('fx-move', 300, 0, '--fx-dx:-44px;--fx-dy:44px')}><path d="M54 34l30-12-10 32-8-12z" class="fx-fill"/><path d="M66 42l18-20"/></g>${[0, 1, 2].map((i) => `<circle cx="${22 + i * 10}" cy="${74 - i * 10}" r="2" class="fx-fill" ${anim('fx-fade', 120, 120 + i * 60)}/>`).join('')}`,
  balloon: () => `<g ${anim('fx-rise', 300, 0, '--fx-dy:50px')}><ellipse cx="50" cy="36" rx="16" ry="20" class="fx-fill"/><path d="M50 56l-3 4h6zM50 60c-4 8 4 14-2 24"/></g>`,
  fireworks: () => `<g ${anim('fx-grow', 250, 0, '--fx-ox:38px;--fx-oy:42px')}>${rays(38, 42, 10, 5, 20)}</g><g ${anim('fx-grow', 250, 120, '--fx-ox:66px;--fx-oy:58px')}>${rays(66, 58, 8, 4, 15)}</g>`,
  'light-bulb': () => `<path d="M50 22a18 18 0 0 0-10 33v9h20v-9a18 18 0 0 0-10-33z" class="fx-bulb" ${anim('fx-light', 160)}/><path d="M42 70h16M44 76h12"/>${rays(50, 40, 5, 24, 32, -Math.PI, 160, 200)}`,
  trophy: () => `<path d="M26 84h48"/><g ${anim('fx-drop', 300, 0, '--fx-dy:-40px')}><path d="M36 26h28v14a14 14 0 0 1-28 0z" class="fx-fill"/><path d="M36 30h-8a8 8 0 0 0 8 10M64 30h8a8 8 0 0 1-8 10M50 54v14M40 76v-8h20v8z"/></g>`,
  gift: () => `<rect x="30" y="50" width="40" height="32" class="fx-fill"/><path d="M50 50v32"/><g ${anim('fx-lid', 300, 0, '--fx-ox:30px;--fx-oy:48px')}><rect x="26" y="40" width="48" height="10"/></g><path d="M58 22l4-8M66 26l8-4" ${anim('fx-fade', 150, 300)}/>`,
  sunrise: () => `<defs><clipPath id="fx-sky"><rect x="0" y="0" width="100" height="66"/></clipPath></defs><g clip-path="url(#fx-sky)"><circle cx="50" cy="60" r="16" class="fx-fill" ${anim('fx-rise', 300, 0, '--fx-dy:34px')}/></g><path d="M14 66h72"/>${rays(50, 60, 5, 22, 30, Math.PI * 1.1, 300, 200)}`,
};

export const EFFECT_CODES = Object.keys(EFFECTS);

/** The effect as an SVG element. still: the final picture without motion (previews). */
export function effectSvg(code, { still = false } = {}) {
  const draw = EFFECTS[code] || EFFECTS.check;
  const node = svg(draw(), '0 0 100 100');
  node.classList.add('fx');
  if (still) node.classList.add('still');
  return node;
}
