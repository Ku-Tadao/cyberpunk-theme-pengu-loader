// Your hover card (the card that pops up when hovering your name/icon):
// applied the moment it appears instead of on the next 1s scan, and it gets
// your custom background (profile background, or the wallpaper if none) the
// way ElainaV4 does it, on #hover-card-backdrop.

import { h } from './ui.js';
import { settings } from './store.js';
import { fileUrl, wallpaperUrl, isVideo } from './assets.js';
import { me } from './me.js';
import { cosmeticsReady } from './icon-override.js';
import { applyTitle } from './title.js';

function background() {
  if (settings.profileBg) return { file: settings.profileBg, url: fileUrl('profileBgs', settings.profileBg) };
  if (settings.wallpaper) return { file: settings.wallpaper, url: wallpaperUrl(settings.wallpaper) };
  return null;
}

function applyBackdrop() {
  const backdrop = document.querySelector('#hover-card-backdrop');
  if (!backdrop) return;
  const tooltip = backdrop.closest('#lol-uikit-tooltip-root') || backdrop.parentElement || document;
  const card = tooltip.querySelector('lol-regalia-hovercard-v2-element[summoner-id]')
    || document.querySelector('lol-regalia-hovercard-v2-element[summoner-id]');
  // by id when the card says whose it is, otherwise by your name in the card
  const mine = card
    ? card.getAttribute('summoner-id') === me.summonerId
    : !!(me.gameName && (backdrop.parentElement?.textContent || '').includes(me.gameName));
  const bg = mine ? background() : null;

  let layer = backdrop.querySelector(':scope > .cc-hover-bg');
  if (!bg) {
    layer?.remove();
    delete backdrop.dataset.ccBg;
    return;
  }
  backdrop.dataset.ccBg = '';
  // our layer must stay inside the card
  if (getComputedStyle(backdrop).position === 'static') backdrop.style.position = 'relative';
  if (layer?.dataset.file === bg.file) return;
  layer?.remove();
  layer = h('div', { class: 'cc-hover-bg' }, isVideo(bg.file)
    ? h('video', { muted: true, autoplay: true, loop: true, playsInline: true, src: bg.url })
    : h('img', { src: bg.url, alt: '' }));
  layer.dataset.file = bg.file;
  backdrop.prepend(layer);
}

// Cover the card with a loader until our icon / border / background are on it (and the
// background image is decoded), so Riot's original card never shows first. The tooltip is
// created by the hover itself, so this runs from the observer, before its first paint.
const COVER_MIN = 450;    // ms the card stays covered at least
const COVER_QUIET = 150;  // ...and until nothing in it has changed for this long
const COVER_MAX = 2000;   // never longer than this (custom pictures are preloaded, so rarely hit)

// one cover per card: Riot updating a card while you hover it must not cover it again
const covered = new WeakSet();
// only your own card (hovering your identity, top right): friends' cards open instantly
let overIdentity = false;
document.addEventListener('mouseover', (e) => { overIdentity = !!e.target.closest?.('.lol-social-identity'); }, true);

function coverCard(run) {
  if (!settings.pageGate || !overIdentity) return;
  const backdrop = document.querySelector('#hover-card-backdrop');
  // the whole card (header + name, rank, status below it), not just the header banner
  const host = backdrop?.closest('.hover-card-container') || backdrop?.closest('#hover-card-header')?.parentElement;
  if (!host || covered.has(host)) return;
  covered.add(host);
  const veil = h('div', { class: 'cc-hc-veil' }, h('div', { class: 'cc-gate-hex' }));
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  host.append(veil);

  const start = performance.now();
  let changed = start;
  const mo = new MutationObserver((records) => {
    // Riot's changes only: not our veil, nor our own data-cc-* marks (re-set on every pass)
    const riot = (r) => !veil.contains(r.target) && !(r.type === 'attributes' && r.attributeName.startsWith('data-cc'));
    if (records.some(riot)) changed = performance.now();
  });
  mo.observe(host, { childList: true, subtree: true, attributes: true, characterData: true });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  (async () => {
    // keep applying our look while Riot fills the card in
    while (performance.now() - start < COVER_MAX) {
      await sleep(100);
      if (!host.isConnected) break;
      run();
      const t = performance.now();
      // built (quiet), and every custom piece is on the card and decoded
      if (t - start >= COVER_MIN && t - changed >= COVER_QUIET && cosmeticsReady(host)) break;
    }
    mo.disconnect();
    // the custom background must be decoded before it is shown
    const img = backdrop.querySelector('.cc-hover-bg img');
    const left = COVER_MAX - (performance.now() - start);
    if (img && !img.complete && left > 0) await Promise.race([img.decode().catch(() => {}), sleep(left)]);
    // two frames so the finished card is painted under the cover before it fades
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    veil.classList.add('out');
    setTimeout(() => veil.remove(), 200);
  })();
}

export function startHoverCard(scanNow) {
  let queued = false;
  const run = () => {
    queued = false;
    applyBackdrop();
    scanNow();
    applyTitle();
  };
  const kick = () => {
    if (queued) return;
    queued = true;
    coverCard(run);
    requestAnimationFrame(run);
    // Riot fills the card in over a few frames (icon URL, crest...): re-check shortly after
    setTimeout(run, 120);
    setTimeout(run, 400);
  };
  // the tooltip layer is created anew for every hover, so watch the page for it
  new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.id === 'lol-uikit-tooltip-root' || n.id === 'hover-card-backdrop'
          || n.closest?.('#lol-uikit-tooltip-root') || n.querySelector?.('#hover-card-backdrop')) {
          kick();
          return;
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
