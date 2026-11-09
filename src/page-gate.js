// Page gate: when a new page opens (a Riot screen becomes active, or an overlay such as a
// profile opens), a short loader covers that area while every custom pass runs right away
// instead of on its 1s timer, so the original Riot look never flashes.
// MutationObserver callbacks run before the next paint, so the veil is up before the new
// page is ever drawn. Pages that fill in late keep the veil until they go quiet (capped).
// The veil never takes clicks. Toggle: settings.pageGate. Styles: theme.css "Page gate".

import { h } from './ui.js';
import { settings } from './store.js';
import { idleInterval } from './perf.js';
import { recolorNow } from './recolor.js';
import { scanNow as iconNow, cosmeticsReady } from './icon-override.js';
import { applyTitle } from './title.js';
import { applyProfileBg } from './profile-bg.js';

// tabs inside a page (Collection: champions / skins / emotes..., Loot tabs): no new screen,
// so the gate is started from the click itself (capture runs before Riot re-renders)
const SUBTABS = '.collections-sub-nav-component lol-uikit-navigation-item, .loot-nav-item, .jade-navigation-component__tab-container';
// Party / Play: the lobby is built across the main and persistent layers, so the gate
// starts from the click and waits for both to settle
const PARTY = '.play-button-component .basic-button';
const LAYERS = ['.rcp-fe-viewport-main', '.rcp-fe-viewport-persistent', '.rcp-fe-viewport-overlay'];
// screens that aren't pages (top bar, backgrounds, small popups)
const SKIP = /navigation|background|rating|toast|notification|ready-check|tooltip|social/i;
const MIN_MS = 160;    // always long enough for one clean frame of the loader
const QUIET_MS = 140;  // the page counts as built after this long without DOM changes
const MAX_MS = 1500;   // never hold a page longer than this
const PASS_MS = 90;    // re-run the passes while the page is still filling in

let veil = null;
let gen = 0;

function passes() {
  for (const fn of [recolorNow, iconNow, applyTitle, applyProfileBg]) {
    try { fn(); } catch {}
  }
}

function makeVeil() {
  return h('div', { class: 'cc-gate' },
    h('div', { class: 'cc-gate-loader' },
      h('div', { class: 'cc-gate-hex' }),
      h('div', { class: 'cc-gate-text' }, 'LOADING', h('i')),
      h('div', { class: 'cc-gate-bar' }, h('i'))));
}

// below: keep this element (a sub-tab bar) visible, cover only what is under it.
// watch: where the page gets built (quiet detection); the screen itself by default.
// until: extra condition for "built" (e.g. the lobby cards exist)
function gate(screen, below = null, watch = [screen], until = () => true) {
  if (!settings.pageGate || SKIP.test(screen.dataset?.screenName || '')) return;
  const r = screen.getBoundingClientRect();
  if (r.width < 300 || r.height < 200) return;
  // main pages: leave the top bar visible; overlays (profile, match details) are covered whole
  const overlay = screen.parentElement?.matches('.rcp-fe-viewport-overlay');
  const nav = document.querySelector('.navbar_backdrop')?.getBoundingClientRect();
  let top = !overlay && nav && nav.bottom > r.top && nav.bottom < r.bottom - 100 ? nav.bottom : r.top;
  const b = below?.getBoundingClientRect();
  if (b && b.bottom > top && b.bottom < r.bottom - 100) top = b.bottom;

  veil ??= makeVeil();
  Object.assign(veil.style, { left: `${r.left}px`, top: `${top}px`, width: `${r.width}px`, height: `${r.bottom - top}px` });
  veil.classList.remove('out');
  (document.querySelector('#rcp-fe-viewport-root') || document.body).append(veil);
  passes();

  const my = ++gen;
  const start = performance.now();
  let changed = start;
  let passed = start;
  const mo = new MutationObserver(() => { changed = performance.now(); });
  for (const el of watch) mo.observe(el, { childList: true, subtree: true });
  const tick = (t) => {
    if (my !== gen) return mo.disconnect();  // a newer page took over the veil
    // passes and the cosmetics check walk the page: every PASS_MS, not every frame
    let ready = false;
    if (t - passed > PASS_MS) {
      passes();
      passed = t;
      // built (quiet) and every custom cosmetic on it in place and decoded
      ready = t - start > MIN_MS && t - changed > QUIET_MS && until() && watch.every((el) => cosmeticsReady(el));
    }
    const built = ready;
    if (!built && t - start < MAX_MS) return requestAnimationFrame(tick);
    mo.disconnect();
    passes();
    requestAnimationFrame(() => {
      if (my !== gen) return;
      veil.classList.add('out');
      setTimeout(() => { if (my === gen) veil.remove(); }, 220);
    });
  };
  requestAnimationFrame(tick);
}

// A lobby you just created or joined: Riot builds it inside the game-select screen (no
// screen change), and the lobby update can arrive before anything is drawn, so wait for the
// player cards themselves, then for their cosmetics. Called from cyberware.js.
export function gateLobby() {
  const root = document.querySelector('#rcp-fe-viewport-root');
  const main = root?.querySelector(':scope > .rcp-fe-viewport-main');
  const built = LAYERS.slice(0, 2).map((s) => root?.querySelector(`:scope > ${s}`)).filter(Boolean);
  const cards =() => !!document.querySelector('.party-members-container .v2-banner-component [puuid]');
  if (main) gate(main, null, built, cards);
}

export function startPageGate() {
  const watchedLayers = new WeakSet();
  const mo = new MutationObserver((records) => {
    for (const rec of records) {
      if (rec.type === 'attributes') {
        // shown: gained 'active', or lost 'hidden' (persistent screens toggle that instead)
        const old = (rec.oldValue || '').split(/\s+/);
        const cl = rec.target.classList;
        if ((!old.includes('active') && cl.contains('active')) || (old.includes('hidden') && !cl.contains('hidden'))) gate(rec.target);
        continue;
      }
      const overlayLayer = rec.target.matches('.rcp-fe-viewport-overlay');
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1 || !node.classList.contains('screen-root')) continue;
        mo.observe(node, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
        if (overlayLayer || node.classList.contains('active')) gate(node);
      }
    }
  });
  // the layer containers exist once the client has booted; attach to each as it appears
  const attach = () => {
    for (const sel of LAYERS) {
      const layer = document.querySelector(`#rcp-fe-viewport-root > ${sel}`);
      if (!layer || watchedLayers.has(layer)) continue;
      watchedLayers.add(layer);
      mo.observe(layer, { childList: true });
      for (const s of layer.children) {
        if (s.classList.contains('screen-root')) mo.observe(s, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
      }
    }
  };
  attach();
  idleInterval(attach, 2000);

  document.addEventListener('click', (e) => {
    const party = e.target.closest?.(PARTY);
    if (party && !party.classList.contains('disabled')) {
      const root = document.querySelector('#rcp-fe-viewport-root');
      const main = root?.querySelector(':scope > .rcp-fe-viewport-main');
      const built = LAYERS.slice(0, 2).map((s) => root?.querySelector(`:scope > ${s}`)).filter(Boolean);
      if (main) gate(main, null, built);
      return;
    }
    const tab = e.target.closest?.(SUBTABS);
    if (!tab || tab.hasAttribute('active') || tab.classList.contains('active') || tab.classList.contains('selected')) return;
    const screen = tab.closest('.screen-root');
    if (screen) gate(screen, tab.parentElement);
  }, true);
}
