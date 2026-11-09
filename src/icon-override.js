// Your icon, everywhere it is drawn (including inside open shadow roots):
//  - custom picture: swaps the image for a file from assets/icons (local only)
//  - custom border: an animated ring over the icon (local only)
// Riot draws most icons in a "crest" (.lol-regalia-crest-root) inside a regalia
// component that carries the player's puuid / summoner-id; those identify you
// reliably. Elsewhere (e.g. the friends list) the icon URL is used.

import { h } from './ui.js';
import { settings } from './store.js';
import { fileUrl } from './assets.js';
import { currentSummoner } from './api.js';
import { applyLocalRank } from './presence.js';
import { isMyProfile } from './me.js';
import { changeInterval } from './perf.js';

let me = { iconId: null, puuid: null, summonerId: null };
let wasActive = true; // first scan also cleans up after older versions

export function initIconOverride(socket) {
  socket.observe('/lol-summoner/v1/current-summoner', ({ data }) => {
    if (data?.profileIconId != null) me.iconId = data.profileIconId;
  });
}

export const scanNow = () => scan();

export function startIconOverride() {
  currentSummoner()
    .then((s) => { me = { iconId: s.profileIconId, puuid: s.puuid, summonerId: String(s.summonerId) }; })
    .catch(() => {});
  changeInterval(scan, 1000, 3000);
}

function visit(root, fn) {
  for (const el of root.querySelectorAll('*')) {
    fn(el);
    if (el.shadowRoot) visit(el.shadowRoot, fn);
  }
}

// Whose icon is this? Walks out through shadow hosts to the nearest component
// that says which player it shows. true / false, or null when unknown.
function isMine(el) {
  let node = el;
  for (let i = 0; i < 8; i++) {
    const host = node.getRootNode().host;
    if (!host) return null;
    const puuid = host.getAttribute('puuid');
    if (puuid) return puuid === me.puuid;
    const sid = host.getAttribute('summoner-id');
    if (sid) return sid === me.summonerId;
    node = host;
  }
  return null;
}

// Older versions swapped Riot's own image sources; put any of those back.
function undoSwap(el, set) {
  if (el.dataset.ccOrig === undefined) return;
  set(el.dataset.ccOrig);
  delete el.dataset.ccOrig;
  delete el.dataset.ccSet;
}

// Draw our picture over an element with CSS `content`: Riot can reset the
// element's own src/background as often as it likes without restarting a GIF.
function contentIcon(el, url) {
  const want = url ? `url("${url}")` : '';
  if (el.style.getPropertyValue('content') === want) return;
  if (url) el.style.setProperty('content', want, 'important');
  else el.style.removeProperty('content');
}

let ringed = new Set();
let bordered = new Set();

function ring(crest, style, image, iconEl) {
  let el = crest.querySelector(':scope > .cc-ring');
  if (!el) {
    el = h('div', { class: 'cc-ring' });
    crest.append(el);
  }
  const mode = image ? 'image' : style;
  if (el.dataset.style !== mode) el.dataset.style = mode;
  if (crest.dataset.ccRing !== mode) crest.dataset.ccRing = mode;
  let img = el.querySelector(':scope > img');
  if (image) {
    if (!img) el.append(img = h('img', { alt: '' }));
    if (img.getAttribute('src') !== image) img.setAttribute('src', image);
  } else img?.remove();

  // match the icon's real box (crest layouts differ between profile, lobby, hover card)
  const box = crest.getBoundingClientRect();
  const icon = iconEl.getBoundingClientRect();
  if (box.width && icon.width) {
    const zoom = crest.offsetWidth ? box.width / crest.offsetWidth : 1;
    const pos = `left:${(icon.left - box.left) / zoom}px;top:${(icon.top - box.top) / zoom}px;width:${icon.width / zoom}px;height:${icon.height / zoom}px;`;
    if (el.getAttribute('style') !== pos) el.setAttribute('style', pos);
  }
}

function overlayIcon(iconEl, url) {
  let img = iconEl.querySelector(':scope > img.cc-icon-img');
  if (!url) { img?.remove(); return; }
  if (!img) {
    img = h('img', { class: 'cc-icon-img', alt: '' });
    iconEl.append(img);
  }
  if (img.getAttribute('src') !== url) img.setAttribute('src', url);
}

// Your banner: our image laid exactly over Riot's static banner image; Riot's
// image, videos and backgrounds are hidden by shadow.css while ours shows.
function banner(host, url) {
  const root = host.shadowRoot;
  if (!root) return;
  const img = root.querySelector('img.regalia-banner-asset-static-image');
  if (img) undoSwap(img, (v) => { img.src = v; });
  // the banner root always fills the banner; Riot's own image box can be
  // faded out or collapsed during its animations
  const holder = root.querySelector('.regalia-banner-v2-root');
  let ours = root.querySelector('img.cc-banner-img');
  if (!url || !holder) {
    ours?.remove();
    delete host.dataset.ccBanner;
    return;
  }
  host.dataset.ccBanner = '';
  if (!ours || ours.parentElement !== holder) {
    ours?.remove();
    ours = h('img', { class: 'cc-banner-img', alt: '' });
    holder.append(ours);
  }
  if (ours.getAttribute('src') !== url) ours.setAttribute('src', url);
}

// For the loading covers: is everything we draw inside `root` (shadow roots included) in
// place and loaded? Riot's crest must have its icon, your crest must carry our picture and
// ring, and every image of ours must be decoded.
const OURS = (el) => el.classList.contains('cc-icon-img') || el.classList.contains('cc-banner-img')
  || el.parentElement?.classList.contains('cc-ring') || el.parentElement?.classList.contains('cc-hover-bg');
export function cosmeticsReady(root) {
  const custom = settings.customIcon ? fileUrl('icons', settings.customIcon) : null;
  const border = !!(settings.iconBorder || settings.borderImage);
  let ready = true;
  let icons = 0;
  const bannerUrl = settings.customBanner ? fileUrl('banners', settings.customBanner) : null;
  visit(root, (el) => {
    if (!ready) return;
    // your banner (lobby card, profile): our image must be laid over Riot's
    if (el.tagName === 'LOL-REGALIA-BANNER-V2-ELEMENT') {
      const sr = el.shadowRoot;
      if (bannerUrl && sr?.querySelector('.regalia-banner-v2-root') && isMine(el) && !sr.querySelector('img.cc-banner-img')) ready = false;
      return;
    }
    if (el.classList?.contains('lol-regalia-summoner-icon')) {
      // icons that are not displayed (the lobby hides its crest) are never filled in: skip
      if (!el.getClientRects().length) return;
      icons++;
      const bg = el.style.backgroundImage;
      if (!bg) { ready = false; return; }  // Riot has not filled the crest in yet
      const who = isMine(el);
      const isMe = bg.includes('profile-icons/') && (who === null ? bg.includes(`profile-icons/${me.iconId}.`) : who);
      if (isMe && custom && !el.querySelector(':scope > img.cc-icon-img')) ready = false;
      if (isMe && border && !el.closest('.lol-regalia-crest-root')?.querySelector(':scope > .cc-ring')) ready = false;
    } else if (el.tagName === 'IMG' && el.getAttribute('src') && OURS(el)) {
      if (!(el.complete && el.naturalWidth)) ready = false;
    } else if (el.tagName === 'VIDEO' && el.parentElement?.classList.contains('cc-hover-bg')) {
      if (el.readyState < 2) ready = false;
    }
  });
  // a card that shows a player but has no crest yet is still being built
  if (ready && !icons && (root.matches?.('[summoner-id], [puuid]') || root.querySelector?.('[summoner-id], [puuid]'))) {
    let shadowCrest = false;
    visit(root, (el) => { if (el.classList?.contains('lol-regalia-crest-root') && el.getClientRects().length) shadowCrest = true; });
    if (shadowCrest) ready = false;
  }
  return ready;
}

function scan() {
  const custom = settings.customIcon ? fileUrl('icons', settings.customIcon) : null;
  const border = settings.iconBorder || (settings.borderImage ? 'image' : '');
  const borderImg = settings.borderImage ? fileUrl('borders', settings.borderImage) : null;
  const bannerUrl = settings.customBanner ? fileUrl('banners', settings.customBanner) : null;
  if (me.iconId == null) return;
  const active = !!(custom || border || bannerUrl || settings.rankTier);
  if (!active && !wasActive) return;
  wasActive = active;
  const needle = `profile-icons/${me.iconId}.`;
  const seenRings = new Set();
  const seenBorders = new Set();

  visit(document, (el) => {
    if (el.tagName === 'LOL-REGALIA-BANNER-V2-ELEMENT') {
      if (isMine(el)) banner(el, bannerUrl);
      return;
    }
    if (el.tagName === 'LOL-REGALIA-EMBLEM-ELEMENT' && el.hasAttribute('ranked-tier')) {
      if (isMyProfile(el) && isMine(el) !== false) applyLocalRank(el);
      return;
    }
    // only actual profile-icon images count (not banners or other art in your regalia)
    const mine = (value) => {
      if (!value.includes('profile-icons/')) return false;
      const who = isMine(el);
      return who === null ? value.includes(needle) : who;
    };
    let hit = false;
    if (el.classList?.contains('lol-regalia-summoner-icon')) {
      // crest icons: lay our image over Riot's instead of swapping it, so an
      // animated GIF keeps playing when the crest redraws
      const bg = el.style.backgroundImage;
      const isMe = bg ? mine(bg) || mine(el.dataset.ccOrig || '') : false;
      overlayIcon(el, isMe ? custom : null);
      if (el.dataset.ccOrig !== undefined) {  // undo the old swap method
        el.style.backgroundImage = el.dataset.ccOrig;
        delete el.dataset.ccOrig;
        delete el.dataset.ccSet;
      }
      hit = isMe;
    } else if (el.tagName === 'IMG') {
      undoSwap(el, (v) => { el.src = v; });
      hit = mine(el.src);
      contentIcon(el, hit ? custom : null);
    } else if (el.style?.backgroundImage) {
      undoSwap(el, (v) => { el.style.backgroundImage = v; });
      hit = mine(el.style.backgroundImage);
      contentIcon(el, hit ? custom : null);
    }
    if (!hit || !border) return;

    const crest = el.closest('.lol-regalia-crest-root');
    if (crest) {
      ring(crest, border, borderImg, el);
      seenRings.add(crest);
    } else {
      if (el.dataset.ccBorder !== border) el.dataset.ccBorder = border;
      seenBorders.add(el);
    }
  });

  for (const crest of ringed) {
    if (seenRings.has(crest)) continue;
    crest.querySelector(':scope > .cc-ring')?.remove();
    delete crest.dataset.ccRing;
  }
  for (const el of bordered) if (!seenBorders.has(el)) delete el.dataset.ccBorder;
  ringed = seenRings;
  bordered = seenBorders;
}
