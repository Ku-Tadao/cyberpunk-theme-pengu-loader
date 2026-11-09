// Saves a compact outline of a few client screens (your profile, your lobby
// card, the top bar...) into DataStore key "cc-debug", so the real markup can be
// inspected from Pengu's datastore file when fixing styling issues. Only tag
// names, classes and a few attributes are kept, and text is trimmed.

import { idleInterval } from './perf.js';

const KEEP_ATTRS = ['id', 'puuid', 'summoner-id', 'ranked-tier', 'ranked-division', 'data-screen-name', 'src', 'style', 'active', 'aria-label', 'title'];

function outline(node, depth = 0, budget = { n: 0 }) {
  if (depth > 14 || budget.n > 1200) return null;
  budget.n++;
  const out = { t: node.tagName?.toLowerCase() };
  if (node.classList?.length) out.c = node.className.toString().slice(0, 160);
  for (const a of KEEP_ATTRS) {
    const v = node.getAttribute?.(a);
    if (v) out[a] = v.slice(0, 120);
  }
  if (node.getBoundingClientRect) {
    const r = node.getBoundingClientRect();
    out.r = `${Math.round(r.width)}x${Math.round(r.height)}`;
    const cs = getComputedStyle(node);
    if (cs.display === 'none') out.v = 'none';
    else if (cs.visibility === 'hidden') out.v = 'hidden';
    else if (cs.opacity === '0') out.v = 'op0';
  }
  const text = [...node.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
  if (text) out.x = text.slice(0, 40);
  const kids = [...(node.children || [])].map((c) => outline(c, depth + 1, budget)).filter(Boolean);
  if (kids.length) out.k = kids;
  if (node.shadowRoot) {
    const sk = [...node.shadowRoot.children].map((c) => outline(c, depth + 1, budget)).filter(Boolean);
    if (sk.length) out.s = sk;
  }
  return out;
}

const SPOTS = {
  profileInfo: '.style-profile-summoner-info-component',
  profileBackdrop: '.style-profile-backdrop-component',
  profileSubNav: '.style-profile-sub-nav',
  lobbyBanner: '.v2-banner-component.local-player',
  gameSelect: '.parties-game-select-screen',
  navbar: '.navbar_backdrop',
  friendsList: '.lol-social-sidebar',
  classicHome: '#activity-center',
  leagueHome: '.jade-home__home-container',
  tftHome: '.rcp-fe-lol-tft-home',
  lobbyFooter: '.v2-footer-component',
  partyPanel: 'lol-parties-game-info-panel',
  readyCheck: '.ready-check-root-element',
  hoverCard: '#hover-card-backdrop',
  lockToggle: '.open-party-toggle-wrapper',
};

let snap = {};

function save(key, el) {
  snap[key] = { at: new Date().toISOString(), tree: outline(el.parentElement || el) };
  DataStore.set('cc-debug', snap);
}

export const saveDebug = save;

function hitTest() {
  const out = {};
  for (const sel of ['.cc-edge-arrow.right', '.cc-edge-arrow.left']) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = 'missing'; continue; }
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out[sel] = `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} pe=${getComputedStyle(el).pointerEvents} top=${top ? (top === el || el.contains(top) ? 'self' : `${top.tagName.toLowerCase()}.${top.className}`.slice(0, 80)) : 'none'}`;
  }
  return out;
}

export function startDebugCapture() {
  snap = DataStore.get('cc-debug') || {};
  // only write when something changed: DataStore.set rewrites the whole store file on disk
  let lastHits = '';
  idleInterval(() => {
    const hits = hitTest();
    const s = JSON.stringify(hits);
    if (s === lastHits) return;
    lastHits = s;
    snap.hits = hits;
    DataStore.set('cc-debug', snap);
  }, 15000);
  const captured = new WeakSet();
  const firstSeen = new WeakMap();
  idleInterval(() => {
    for (const [key, sel] of Object.entries(SPOTS)) {
      const el = document.querySelector(sel);
      if (!el || captured.has(el) || !el.getClientRects().length) continue;
      // wait until intro animations are over
      if (!firstSeen.has(el)) { firstSeen.set(el, Date.now()); continue; }
      if (Date.now() - firstSeen.get(el) < 4000) continue;
      captured.add(el);
      save(key, el);
    }
  }, 1000);
}

export const resetDebugCapture = () => { snap = {}; DataStore.set('cc-debug', snap); };
