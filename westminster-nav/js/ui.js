// Tiny DOM helpers.

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const pick = (arr, rand = Math.random) => arr[Math.floor(rand() * arr.length)];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const miles = (m) => `${(m / 1609.344).toFixed(m < 1609 ? 2 : 1)} mi`;

/** Elapsed-time display that ticks until stopped. */
export function stopwatch(node) {
  const t0 = performance.now();
  const id = setInterval(() => { node.textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's'; }, 100);
  return { stop: () => { clearInterval(id); return performance.now() - t0; } };
}

/** Key handler that is removed automatically when the view changes. */
let keyHandler = null;
export function onKeys(fn) {
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = (e) => {
    if (e.target?.closest?.('input, select, textarea')) return;
    fn(e);
  };
  window.addEventListener('keydown', keyHandler);
}
export function clearKeys() {
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = null;
}

export function scoreBar(s) {
  const pct = s.played ? Math.round((100 * s.correct) / s.played) : 0;
  return el('div', { class: 'scorebar' },
    el('span', {}, el('b', {}, s.points), ' pts'),
    el('span', {}, el('b', {}, `${pct}%`), ` of ${s.played}`),
    el('span', {}, 'streak ', el('b', {}, s.streak)),
    el('span', {}, 'best ', el('b', {}, s.best)));
}

// Let views pass optional children (`cond ? node : null`) to append and
// replaceChildren without rendering the text "null".
for (const name of ['append', 'replaceChildren']) {
  const native = Element.prototype[name];
  Element.prototype[name] = function patched(...kids) {
    return native.apply(this, kids.filter((k) => k != null && k !== false));
  };
}
