// Tiny DOM builder. Text is always set with textContent (user input is never parsed as HTML).

// Marked system tags from text.js (TAG_OPEN + name + TAG_CLOSE).
const MARKED_TAG = /\uE000([^\uE001]*)\uE001/g;

/** A string as nodes: marked tags become <span class="sys-tag"> (symbols come from the theme CSS). */
export function textNodes(s) {
  const str = String(s);
  if (!str.includes('\uE000')) return [document.createTextNode(str)];
  const out = [];
  let last = 0;
  for (const m of str.matchAll(MARKED_TAG)) {
    if (m.index > last) out.push(document.createTextNode(str.slice(last, m.index)));
    const tag = document.createElement('span');
    tag.className = 'sys-tag';
    tag.textContent = m[1];
    out.push(tag);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(document.createTextNode(str.slice(last)));
  return out;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value).replace(MARKED_TAG, '[$1]'));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    if (child instanceof Node) node.append(child);
    else node.append(...textNodes(child));
  }
  return node;
}

/** Build an inline SVG from markup we wrote ourselves (icons only, never user text). */
export function svg(markup, viewBox = '0 0 24 24') {
  const ns = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(ns, 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = markup;
  return node;
}

export function mount(root, ...nodes) {
  root.replaceChildren(...nodes);
}
