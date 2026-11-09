// "Someone joined your lobby":
//  - their lobby card + banner "decode" into view: a hex-code overlay with a scan
//    bar and DECODING %, while the card is revealed top-down in steps
//    (theme.css "Card decode"); every card decodes on its own
//  - one Breach Protocol sequence (cyberware.js, mode "join") for everyone who
//    joins close together: joins within ~0.6s share a sequence, joins arriving
//    while one plays are added to it, later ones get the next sequence
// Riot IDs are looked up first so names are never blank.

import { h } from './ui.js';
import { lcu, summonerByPuuid } from './api.js';
import { breach } from './cyberware.js';
import { markBusy } from './perf.js';
import { playSound } from './sounds.js';

const CODES = ['1C', '55', 'BD', 'E9', '7A', 'FF'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DECODE_MS = 1900;
const WIPE_MS = 450;  // leave: the overlay wipes in before the card decodes away

// lobby data often lacks the Riot ID: try the account, friends list, summoner id
async function resolveName(m) {
  const named = (name, tag) => (name ? { name, tag: tag || '' } : null);
  const quick = named(m.gameName, m.gameTag);
  if (quick) return quick;
  const tries = [
    async () => {
      const s = m.puuid ? await summonerByPuuid(m.puuid) : null;
      return named(s?.gameName, s?.tagLine) || named(s?.displayName);
    },
    async () => {
      const f = (await lcu('/lol-chat/v1/friends') || []).find((x) => x.puuid === m.puuid);
      return named(f?.gameName, f?.gameTag);
    },
    async () => {
      const s = m.summonerId ? await lcu(`/lol-summoner/v1/summoners/${m.summonerId}`) : null;
      return named(s?.gameName, s?.tagLine) || named(s?.displayName);
    },
  ];
  const lookup = (async () => {
    for (const t of tries) {
      try {
        const r = await t();
        if (r) return r;
      } catch {}
    }
    return null;
  })();
  const timeout = new Promise((r) => setTimeout(() => r(null), 1500));
  return (await Promise.race([lookup, timeout])) || named(m.summonerName) || { name: 'UNKNOWN RUNNER', tag: '' };
}

// ---------- card decode ----------

// hex rain + scan bar + percentage; backwards counts 100% -> 000% after the overlay wipes in
function decodeOverlay(word, backwards) {
  const label = h('span', {}, backwards ? '100%' : '000%');
  const rain = h('div', { class: 'cc-decode-rain' },
    ...Array.from({ length: 6 }, (_, c) => h('div', { class: 'cc-decode-col', style: `--c:${c};--d:${(Math.random() * 0.5).toFixed(2)}s` },
      ...Array.from({ length: 16 }, () => h('span', {}, pick(CODES))))));
  const overlay = h('div', { class: 'cc-decode' },
    rain,
    h('i', { class: 'cc-decode-scan' }),
    h('div', { class: 'cc-decode-label' }, h('b', {}, word), label));
  const cells = [...rain.querySelectorAll('span')];
  const t0 = performance.now() + (backwards ? WIPE_MS : 0);
  const end = t0 + DECODE_MS;
  const frame = (t) => {
    const k = Math.max(0, Math.min(1, (t - t0) / DECODE_MS));
    label.textContent = `${String(Math.round((backwards ? 1 - k : k) * 100)).padStart(3, '0')}%`;
    for (let i = 0; i < 6; i++) cells[Math.floor(Math.random() * cells.length)].textContent = pick(CODES);
    if (t < end) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return overlay;
}

function findCard(puuid) {
  for (const el of document.querySelectorAll('.party-members-container [puuid]')) {
    if (el.getAttribute('puuid') === puuid) return el.closest('.v2-banner-component');
  }
  return null;
}

export async function decodeCard(member, cardEl = null) {
  // the card is rendered a moment after the lobby update
  let card = cardEl;
  for (let t = 0; !card && t < 4000; t += 100) {
    card = findCard(member.puuid);
    if (!card) await sleep(100);
  }
  if (!card || card.dataset.ccDecode !== undefined) return;
  if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

  const overlay = decodeOverlay('DECODING', false);
  card.dataset.ccDecode = '';
  card.append(overlay);
  markBusy(DECODE_MS + 400);

  setTimeout(() => overlay.classList.add('done'), DECODE_MS);
  setTimeout(() => {
    overlay.remove();
    delete card.dataset.ccDecode;
  }, DECODE_MS + 500);
}

// ---------- card un-decode (someone left): the decode played backwards ----------
// Riot destroys the leaver's card at once (the others shift over), so the removed
// node itself is put back where it was, absolutely positioned, and decoded away.
// The socket (noteMemberLeft) and the DOM removal can arrive in either order.

const rects = new Map();    // puuid -> last viewport rect of their card
const removed = new Map();  // puuid -> { node, parent, at } cards removed, not yet confirmed as a leave
const leavers = new Map();  // puuid -> time the lobby said they left
let lastLeaveSound = 0;
let watched = null;
let observer = null;

const cardPuuid = (node) => node.querySelector?.('[puuid]')?.getAttribute('puuid')
  || (node.getAttribute?.('puuid') ?? null);

// called on every lobby update (before Riot re-renders) and periodically
export function rememberCards() {
  const box = document.querySelector('.party-members-container');
  if (!box) return;
  for (const card of box.querySelectorAll('.v2-banner-component')) {
    if (card.closest('.cc-ghost')) continue;
    const puuid = cardPuuid(card);
    const r = card.getBoundingClientRect();
    if (puuid && r.width) rects.set(puuid, r);
  }
  if (box !== watched) {
    observer?.disconnect();
    watched = box;
    observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.removedNodes) {
          if (node.nodeType !== 1 || node.classList.contains('cc-ghost')) continue;
          if (!(node.matches('.v2-banner-component') || node.querySelector('.v2-banner-component'))) continue;
          const puuid = cardPuuid(node);
          if (!puuid) continue;
          if (Date.now() - (leavers.get(puuid) || 0) < 3000) ghost(puuid, node, rec.target);
          else removed.set(puuid, { node, parent: rec.target, at: Date.now() });
        }
      }
      // cards removed by lobby refreshes (not leaves) must not pile up
      for (const [p, r] of removed) if (Date.now() - r.at > 3000) removed.delete(p);
      for (const [p, t] of leavers) if (Date.now() - t > 3000) leavers.delete(p);
    });
    observer.observe(box, { childList: true, subtree: true });
  }
}

export function noteMemberLeft(puuid) {
  const r = removed.get(puuid);
  if (r && Date.now() - r.at < 1500) ghost(puuid, r.node, r.parent);
  else leavers.set(puuid, Date.now());
}

function ghost(puuid, node, parent) {
  removed.delete(puuid);
  leavers.delete(puuid);
  const rect = rects.get(puuid);
  if (!rect || !parent.isConnected || node.isConnected) return;
  const card = node.matches('.v2-banner-component') ? node : node.querySelector('.v2-banner-component');
  if (!card?.querySelector('.lobby-banner')) return;

  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  const p = parent.getBoundingClientRect();
  node.classList.add('cc-ghost');
  Object.assign(node.style, {
    left: `${rect.left - p.left + parent.scrollLeft}px`,
    top: `${rect.top - p.top + parent.scrollTop}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  if (card !== node && getComputedStyle(card).position === 'static') card.style.position = 'relative';
  card.dataset.ccUndecode = '';
  const overlay = decodeOverlay('UNLINKING', true);
  card.append(overlay);
  parent.append(node);
  markBusy(WIPE_MS + DECODE_MS + 400);
  // timed to the wipe + backwards decode; people leaving together get one sound
  if (Date.now() - lastLeaveSound > 700) { lastLeaveSound = Date.now(); playSound('node-leave'); }
  setTimeout(() => overlay.classList.add('out'), WIPE_MS + DECODE_MS);
  setTimeout(() => node.remove(), WIPE_MS + DECODE_MS + 350);
}

// ---------- batching ----------

let pending = [];
let firstPendingAt = 0;
let timer = null;
let active = null;

function flush() {
  if (!pending.length) return;
  if (active && !active.done()) {  // one sequence at a time
    timer = setTimeout(flush, 250);
    return;
  }
  active = breach('join', { whos: pending });
  pending = [];
}

// the join sound (timed to the card decode + breach panel): someone else joined (not your
// own card appearing, not a lobby refresh); people joining together get one sound
let lastBlip = 0;

export function playMemberJoined(member) {
  if (Date.now() - lastBlip > 700) { lastBlip = Date.now(); playSound('node-join'); }
  decodeCard(member);
  const who = resolveName(member);
  if (active && active.accepting()) {  // a sequence is running: join it
    active.add([who]);
    return;
  }
  if (!pending.length) firstPendingAt = Date.now();
  pending.push(who);
  clearTimeout(timer);
  // wait briefly for others joining at the same moment (never more than 1.2s)
  timer = setTimeout(flush, Math.max(0, Math.min(600, 1200 - (Date.now() - firstPendingAt))));
}
