// Start screen (pick a player name or play anonymously) and the scoreboard.

import { el } from '../ui.js';
import * as store from '../store.js';
import * as board from '../scoreboard.js';

const COMPASS = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" fill="none" stroke="#f2b705" stroke-width="4"/><path d="M32 8 L39 32 L32 56 L25 32 Z" fill="#c1121f"/><path d="M32 8 L39 32 L25 32 Z" fill="#f2b705"/><circle cx="32" cy="32" r="3.5" fill="#0d0b0a" stroke="#f2b705" stroke-width="2"/></svg>';

const GAME_TABS = [
  { id: 'all', label: 'Overall' },
  { id: 'flashcards', label: 'Rotations' },
  { id: 'turn', label: 'Turn Signal' },
  { id: 'cardinal', label: 'Cardinal' },
  { id: 'router', label: 'Router' },
];

export function splash(root, ctx, done) {
  const current = store.player();
  const known = store.knownPlayers();
  const input = el('input', {
    id: 'player-name', type: 'text', maxlength: '24', autocomplete: 'nickname', placeholder: 'e.g. Casas, St 4',
    value: current?.name || '', 'aria-label': 'Player name',
  });
  const err = el('p', { class: 'form-error', role: 'alert' });
  const choose = (p) => {
    store.setPlayer(p);
    board.announce();
    done();
  };
  const form = el('form', {
    class: 'splash-form',
    onsubmit: (e) => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (name.length < 2) { err.textContent = 'Use at least 2 characters so your crew can tell who you are.'; input.focus(); return; }
      choose({ name });
    },
  },
  el('label', { for: 'player-name' }, 'Player name'),
  el('div', { class: 'row' }, input, el('button', { type: 'submit', class: 'btn primary' }, 'Start')),
  err);

  root.append(el('section', { class: 'splash' },
    el('div', { class: 'splash-mark', 'aria-hidden': 'true', html: COMPASS }),
    el('h1', {}, 'WFD Nav Trainer'),
    el('p', { class: 'lede' }, 'Street rotations, turn-outs, directions and routes for Westminster Fire. Pick a name to keep score and get on the scoreboard, or play anonymously.'),
    form,
    known.length ? el('div', { class: 'known' },
      el('small', { class: 'muted' }, 'Played on this device'),
      el('div', { class: 'chips' }, known.map((n) => el('button', { type: 'button', class: current?.name === n ? 'chip on' : 'chip', onclick: () => choose({ name: n }) }, n)))) : null,
    el('div', { class: 'divider' }, el('span', {}, 'or')),
    el('button', { type: 'button', class: 'btn', onclick: () => choose({ anon: true }) }, 'Play anonymously'),
    el('p', { class: 'muted small' }, 'Anonymous scores stay on this device and are not shown on the scoreboard.'),
  ));
  setTimeout(() => input.focus(), 50);
}

export function scores(root) {
  let tab = store.load('scores:tab', 'all');
  const me = store.player();
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const note = el('p', { class: 'muted small' });
  const body = el('div', { class: 'board' });
  root.append(el('h1', { class: 'game-title' }, 'Scoreboard'), tabs, note, body);

  let rows = [];
  let mode = 'local';
  function render() {
    tabs.replaceChildren(...GAME_TABS.map((t) => el('button', {
      class: t.id === tab ? 'tab on' : 'tab', role: 'tab', 'aria-selected': String(t.id === tab),
      onclick: () => { tab = t.id; store.save('scores:tab', tab); render(); },
    }, t.label)));
    note.textContent = mode === 'shared'
      ? (board.isReadOnly()
        ? 'Shared scoreboard. You can view it, but your scores can\'t be posted: ask the page owner for Contributor access.'
        : 'Shared scoreboard: everyone who opens this page sees it. Scores post as you play.')
      : 'Scoreboard for players on this device.';
    const pick = (r) => (tab === 'all' ? r : { ...r, ...(r.games?.[tab] || { points: 0, played: 0, correct: 0, best: 0 }) });
    const list = rows.map(pick).filter((r) => r.played > 0).sort((a, b) => b.points - a.points || b.correct - a.correct);
    if (!list.length) {
      body.replaceChildren(el('div', { class: 'panel empty' },
        el('b', {}, 'No scores yet.'),
        el('p', {}, me?.name ? 'Play any game and your points show up here.' : 'Pick a player name on the start screen to get on the board.'),
        el('a', { class: 'btn primary', href: me?.name ? '#/' : '#/player' }, me?.name ? 'Pick a game' : 'Choose a name')));
      return;
    }
    body.replaceChildren(el('div', { class: 'table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {},
        el('th', { class: 'num' }, '#'), el('th', {}, 'Player'), el('th', { class: 'num' }, 'Points'),
        el('th', { class: 'num' }, 'Accuracy'), el('th', { class: 'num' }, 'Answered'), el('th', { class: 'num' }, 'Best streak'))),
      el('tbody', {}, list.map((r, i) => el('tr', { class: r.mine && me?.name && r.name.toLowerCase() === me.name.toLowerCase() ? 'me' : '' },
        el('td', { class: 'num rank' }, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1),
        el('td', {}, r.name),
        el('td', { class: 'num' }, el('b', {}, r.points)),
        el('td', { class: 'num' }, `${r.played ? Math.round((100 * r.correct) / r.played) : 0}%`),
        el('td', { class: 'num' }, r.played),
        el('td', { class: 'num' }, r.best)))))));
  }
  const stop = board.watch((r, m) => { rows = r; mode = m; render(); });
  return { destroy: stop };
}
