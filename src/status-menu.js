// Click the availability dot next to your name (top right) to pick a status:
// Online / In game / Away / Mobile / Offline, or Real to let Riot decide.
// Replaces Riot's own small menu there. Applied through presence.js, which shows
// the real queue / champ select / in-game status while you're actually busy.

import { h } from './ui.js';
import { settings, update } from './store.js';
import { STATUSES } from './presence.js';

const DOT = { '': 'real', chat: 'chat', ingame: 'ingame', away: 'away', mobile: 'mobile', offline: 'offline' };

export function startStatusMenu() {
  const menu = h('div', { class: 'cc-status-menu' });
  let open = false;

  let closing = 0;
  const close = () => {
    if (!open) return;
    open = false;
    menu.classList.remove('open');
    // short fold-up (theme.css "Motion v2") before it hides
    menu.classList.add('closing');
    clearTimeout(closing);
    closing = setTimeout(() => menu.classList.remove('closing'), 160);
  };

  const draw = () => menu.replaceChildren(
    h('div', { class: 'cc-status-title' }, 'Status'),
    h('div', { class: 'cc-status-note' }, 'Switches to In game / Champ select automatically while you play'),
    ...STATUSES.map(([value, label]) => h('div', {
      class: 'cc-status-item' + (settings.status === value ? ' active' : ''),
      onclick: (e) => { e.stopPropagation(); update({ status: value }); close(); },
    }, h('i', { class: `cc-status-dot ${DOT[value]}` }), label)));

  const show = (anchor) => {
    draw();
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 190, r.left - 8))}px`;
    menu.style.top = `${r.bottom + 8}px`;
    const root = document.querySelector('#rcp-fe-viewport-root') || document.body;
    if (menu.parentElement !== root) root.append(menu);
    open = true;
    clearTimeout(closing);
    menu.classList.remove('closing');
    menu.classList.add('open');
  };

  // take over clicks on your own availability dot before Riot sees them
  const intercept = (e) => {
    const hit = e.target.closest?.('.lol-social-identity .availability-hitbox, .lol-social-identity .lol-social-availability-hitbox');
    if (hit) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.type === 'click') {
        if (open) close();
        else show(hit);
      }
      return;
    }
    if (open && e.type === 'mousedown' && !menu.contains(e.target)) close();
  };
  for (const type of ['mousedown', 'mouseup', 'click']) document.addEventListener(type, intercept, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
