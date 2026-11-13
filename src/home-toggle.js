// Two edge arrows that slide whole parts of the UI away to show the background
// (ElainaV4-style, but the complete panel moves as one):
//  - right arrow: the friends panel (glass background included) glides off the
//    right edge and the lobby re-centres in the freed space
//  - left arrow (League / Classic / TFT home screens): the page content glides
//    off the left edge
// Transforms are set inline (re-applied as screens re-render) and only animate
// transform / opacity. Styles: theme.css "Edge arrows".

import { h, icon } from './ui.js';
import { settings, update } from './store.js';
import { asleep } from './perf.js';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SIDEBAR = ['.lol-social-sidebar'];
// the footer's centre column, not the footer: the lobby chat in it is position:fixed
const RECENTER = ['.parties-game-type-select-wrapper', '.parties-custom-game-setup', '.custom-game-list', '.v2-footer-component .center-container',
  '.party-members-container', '.parties-invite-dropzone', '.tft-cards-container', '.multiteam-lobby-root__scrollable-wrapper'];
// top-right bar contents and bottom-right panels (lobby invited + game mode progression,
// footer notifications, home progression badge). The panels themselves move, never their
// containers: a transform on a container re-anchors Riot's absolutely placed panels.
const FOLLOW = ['.main-nav-bar .right-nav-menu', '.v2-footer-component .invite-info-panel-container', '.v2-footer-notifications', '.jade-progression-widget'];
const HOMES = ['#activity-center', '.jade-home__home-container', '.jade-home__play-button', '.rcp-fe-lol-tft-home'];

function slide(selectors, transform, opacity) {
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      el.style.transition = `transform 0.6s ${EASE}, opacity 0.5s ${EASE}`;
      el.style.willChange = transform ? 'transform' : '';
      el.style.transform = transform || '';
      if (opacity !== undefined) {
        el.style.opacity = opacity;
        el.style.pointerEvents = opacity === '0' ? 'none' : '';
      }
    }
  }
}

function arrow(side, key, title) {
  const btn = h('div', {
    class: `cc-edge-arrow ${side}`,
    title,
    onclick: (e) => { e.stopPropagation(); update({ [key]: !settings[key] }); },
  });
  const draw = () => {
    const hidden = settings[key];
    // points the way the panel will move
    const name = side === 'right' ? (hidden ? 'back' : 'chevronRight') : (hidden ? 'chevronRight' : 'back');
    btn.replaceChildren(icon(name, 16));
    btn.classList.toggle('hidden-state', hidden);
  };
  draw();
  return { btn, draw };
}

export function startHomeToggle(subscribe) {
  const right = arrow('right', 'friendsHidden', 'Hide / show friends list');
  const left = arrow('left', 'homeHidden', 'Hide / show the page');

  const applyFriends = () => {
    const hidden = settings.friendsHidden;
    document.body.classList.toggle('cc-friends-hidden', hidden);
    slide(SIDEBAR, hidden ? 'translateX(calc(100% + 4px))' : '');
    slide(RECENTER, hidden ? 'translateX(113px)' : '');
    // the bar's icons + wallet and the bottom-right panels follow the sidebar to the
    // window edge; the bar's glass grows by --cc-side-w to meet them (theme.css)
    const w = document.querySelector('.lol-social-sidebar')?.offsetWidth || 224;
    document.documentElement.style.setProperty('--cc-side-w', `${w}px`);
    slide(FOLLOW.slice(1), hidden ? `translateX(${w}px)` : '');
    // the wallet ends the bar: stop short of the window buttons (minimize / close) above it
    const ctrl = document.querySelector('.riotclient-app-controls')?.getBoundingClientRect();
    const room = ctrl?.width && ctrl.left > innerWidth - w ? innerWidth - ctrl.left + 12 : 0;
    slide(FOLLOW.slice(0, 1), hidden ? `translateX(${w - room}px)` : '');
  };
  const applyHome = () => {
    const hidden = settings.homeHidden;
    document.body.classList.toggle('cc-home-hidden', hidden);
    slide(HOMES, hidden ? 'translateX(-60px)' : '', hidden ? '0' : '');
  };
  applyFriends();
  applyHome();

  subscribe((patch) => {
    if ('friendsHidden' in patch) { right.draw(); applyFriends(); }
    if ('homeHidden' in patch) { left.draw(); applyHome(); }
  });

  // the arrows live in the client's viewport root (it takes clicks, and dialogs stack above it); the slide is
  // re-applied as screens re-render, and the left arrow shows only on home screens
  setInterval(() => {
    if (asleep()) return;
    const root = document.querySelector('#rcp-fe-viewport-root') || document.body;
    for (const b of [right.btn, left.btn]) if (b.parentElement !== root) root.append(b);
    // drop stray copies (seen left behind as direct children of <body>): a dead one keeps
    // floating at the panel's old edge and swallows the clicks meant for the real arrow
    for (const el of document.querySelectorAll('.cc-edge-arrow')) if (el !== right.btn && el !== left.btn) el.remove();
    // no arrow while the friends panel is gone, a dialog is open over the arrow, or a
    // full-screen page covers the panel
    // ponytail: two probe points at mid-height (the arrow's spot, the panel's edge)
    const side = document.querySelector('.lol-social-sidebar');
    const hidden = settings.friendsHidden;
    const y = innerHeight / 2;
    const edge = hidden ? innerWidth : innerWidth - (side?.offsetWidth || 0);
    const dialogAt = (x, btn) => !!document.elementsFromPoint(x, y).find((el) => !btn.contains(el))?.closest('#lol-uikit-layer-manager');
    const shown = !!side?.getClientRects().length
      && !dialogAt(edge - 7, right.btn)
      && (hidden || side.contains(document.elementFromPoint(edge + 4, y)));
    left.btn.classList.toggle('covered', dialogAt(7, left.btn));
    right.btn.classList.toggle('covered', !shown);
    if (settings.friendsHidden) applyFriends();
    if (settings.homeHidden) applyHome();
    const onHome = HOMES.some((sel) => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length));
    left.btn.classList.toggle('shown', onHome || settings.homeHidden);
  }, 700);
}
