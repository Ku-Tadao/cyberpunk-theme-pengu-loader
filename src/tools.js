// Lobby lock / open slider: a padlock beside it whose shackle animates from
// Riot's own .open state on the slider (styles: theme.css "Lobby lock").
// Also keeps the current gameflow phase on <body data-cc-phase>.

import { h } from './ui.js';
import { idleInterval } from './perf.js';

function lockIcon() {
  const el = h('div', { class: 'cc-lock', title: 'Lock / open the party' });
  el.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">'
    + '<path class="shackle" d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11"/>'
    + '<rect class="body" x="4.5" y="11" width="15" height="10"/>'
    + '<path class="keyhole" d="M12 15v2.5"/></svg>';
  return el;
}

export function initTools(context) {
  context.socket.observe('/lol-gameflow/v1/gameflow-phase', ({ data }) => {
    document.body.dataset.ccPhase = data || 'None';
  });
}

export function startTools() {
  fetch('/lol-gameflow/v1/gameflow-phase')
    .then((r) => (r.ok ? r.json() : null))
    .then((p) => { document.body.dataset.ccPhase = p || 'None'; })
    .catch(() => {});

  idleInterval(() => {
    const toggle = document.querySelector('.open-party-toggle-wrapper');
    if (toggle && !toggle.querySelector(':scope > .cc-lock')) toggle.prepend(lockIcon());
  }, 700);
}
