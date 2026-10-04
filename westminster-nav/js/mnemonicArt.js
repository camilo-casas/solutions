// Poster art for each street mnemonic: the street name, the keyword picture,
// the number pegs in digit order and the hundred block, drawn as SVG in the
// WFD palette. Opened by tapping a mnemonic on a flash card.

import { el } from './ui.js';
import { mnemonic } from './lib/mnemonics.js';

const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
// Accent per rotation: red, gold, maroon, slate.
const ACCENT = { 1: '#c1121f', 2: '#f2b705', 3: '#9e1b32', 4: '#5b7083' };

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** SVG markup for a street's mnemonic poster. */
export function posterSVG(s) {
  const m = mnemonic(s);
  if (!m) return '';
  const accent = ACCENT[s.rotation] || '#c1121f';
  const W = 600;
  const H = 760;
  const n = m.pegs.length;
  const slot = Math.min(150, 520 / n);
  const x0 = W / 2 - (slot * (n - 1)) / 2;
  const pegs = m.pegs.map((p, i) => {
    const x = x0 + i * slot;
    const arrow = i < n - 1 ? `<text x="${x + slot / 2}" y="532" text-anchor="middle" font-size="30" fill="#f2b705" font-family="sans-serif">›</text>` : '';
    return `<circle cx="${x}" cy="520" r="54" fill="#fff8e1" stroke="${accent}" stroke-width="5"/>
      <text x="${x}" y="540" text-anchor="middle" font-size="58" font-family='${EMOJI}'>${p.art}</text>
      <text x="${x}" y="606" text-anchor="middle" font-size="34" font-weight="800" fill="#f2b705" font-family="Barlow Semi Condensed, Arial Narrow, sans-serif">${p.digit}</text>
      <text x="${x}" y="630" text-anchor="middle" font-size="17" fill="#d9d2c8" font-family="Barlow, sans-serif" letter-spacing="1">${esc(p.word.toUpperCase())}</text>${arrow}`;
  }).join('');
  const art = [...m.art];
  const big = art.length > 2 ? 120 : art.length > 1 ? 150 : 200;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${s.name}, ${s.block}: ${m.text}`)}">
    <defs>
      <radialGradient id="glow" cx="50%" cy="42%" r="45%"><stop offset="0" stop-color="${accent}" stop-opacity="0.55"/><stop offset="1" stop-color="#0d0b0a" stop-opacity="0"/></radialGradient>
      <pattern id="rays" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="20" height="40" fill="#ffffff" opacity="0.025"/></pattern>
    </defs>
    <rect width="${W}" height="${H}" rx="28" fill="#0d0b0a"/>
    <rect width="${W}" height="${H}" rx="28" fill="url(#rays)"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="22" fill="none" stroke="#f2b705" stroke-width="4"/>
    <rect x="10" y="10" width="${W - 20}" height="96" rx="22" fill="${accent}"/>
    <rect x="10" y="80" width="${W - 20}" height="26" fill="${accent}"/>
    <text x="${W / 2}" y="78" text-anchor="middle" font-size="56" font-weight="800" fill="${s.rotation === 2 ? '#0d0b0a' : '#ffffff'}" font-family="Barlow Semi Condensed, Arial Narrow, sans-serif" letter-spacing="2">${esc(s.name.toUpperCase())}</text>
    <circle cx="${W / 2}" cy="300" r="230" fill="url(#glow)"/>
    <text x="${W / 2}" y="${300 + big * 0.36}" text-anchor="middle" font-size="${big}" font-family='${EMOJI}' transform="rotate(-6 ${W / 2} 300)">${art.join('')}</text>
    ${pegs}
    <text x="${W / 2}" y="722" text-anchor="middle" font-size="84" font-weight="800" fill="#f2b705" font-family="Barlow Semi Condensed, Arial Narrow, sans-serif" letter-spacing="4">${s.block}</text>
  </svg>`;
}

let dialog = null;

/** Open the poster for a street in a modal dialog. */
export function openPoster(s) {
  const m = mnemonic(s);
  if (!m) return;
  if (!dialog) {
    dialog = el('dialog', { class: 'poster-dialog', 'aria-label': 'Mnemonic picture' });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    document.body.append(dialog);
  }
  dialog.replaceChildren(
    el('div', { class: 'poster', html: posterSVG(s) }),
    el('p', { class: 'poster-text' }, m.text),
    el('p', { class: 'poster-pegs muted' }, `${s.block}: ${m.pegs.map((p) => `${p.digit} = ${p.word}`).join(', ')}`),
    el('button', { class: 'btn primary', type: 'button', onclick: () => dialog.close() }, 'Close'));
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
}
