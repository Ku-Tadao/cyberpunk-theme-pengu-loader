// Cyberpunk 2077 "Breach Protocol" HUD, in three modes:
//  - enter (~5.3s): you create / join a lobby. The frame unfolds, a hex matrix
//    appears, a cursor picks a path into the BUFFER, the log lists the uplink
//    and runners in the lobby, the upload bar fills, ACCESS GRANTED glitches in.
//  - join (~2.7s): someone joins your lobby. Same screen, compact and faster,
//    ending on their name.
//  - leave (~2.6s): you leave a lobby. Red: the bar drains, codes fail,
//    LINK TERMINATED, glitch out.
// Codes, path, wording and tint are randomised. Only transform / opacity /
// clip-path animate; everything is click-through. Styles: theme.css
// "Breach protocol".

import { h } from './ui.js';
import { settings } from './store.js';
import { lcu, summonerByPuuid } from './api.js';
import { playSound } from './sounds.js';
import { me } from './me.js';
import { markBusy, idleInterval } from './perf.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const CODES = ['1C', '55', 'BD', 'E9', '7A', 'FF'];
export const hexId = () => Array.from({ length: 3 }, () => pick(CODES)).join('-');

const LOGS = {
  enter: [
    ['> JACKING IN // NET UPLINK', '> ICE SIGNATURE ...... BYPASSED', '> DAEMON UPLOAD ...... OK'],
    ['> BREACH PROTOCOL INITIATED', '> SUBNET ROUTE ...... LOCKED', '> FIREWALL ...... DISABLED'],
    ['> KIROSHI OPTICS ONLINE', '> NEURAL HANDSHAKE ...... OK', '> SQUAD CHANNEL ...... OPEN'],
  ],
  join: [['> INCOMING HANDSHAKE', '> SIGNATURE ...... VERIFIED'], ['> NEW NODE DETECTED', '> ICE ...... BYPASSED']],
  leave: [['> CLOSING SQUAD CHANNEL', '> PURGING SESSION DATA'], ['> DISCONNECTING FROM NET', '> WIPING TRACE']],
};
const STAMPS = {
  enter: ['ACCESS GRANTED', 'LINK ESTABLISHED', 'UPLINK COMPLETE', 'BREACH SUCCESSFUL'],
  leave: ['LINK TERMINATED', 'CONNECTION LOST', 'SIGNAL LOST'],
};
const MODES = {
  //      speed  matrix buffer segs  title
  enter: [1, 5, 6, 24, 'BREACH PROTOCOL // NET UPLINK'],
  join: [0.5, 4, 4, 16, 'BREACH PROTOCOL // NEW CONNECTION'],
  leave: [0.5, 4, 4, 16, 'NET UPLINK // DISCONNECTING'],
};

function segmented(count) {
  return h('div', { class: 'cc-bp-segs' }, ...Array.from({ length: count }, (_, i) => h('i', { style: `--i:${i}` })));
}

function typeLine(box, text, cls, speed) {
  const row = h('div', { class: `cc-bp-line ${cls}` });
  box.append(row);
  let n = 0;
  const t = setInterval(() => {
    n += 1;
    row.textContent = text.slice(0, n);
    if (n >= text.length) clearInterval(t);
  }, 22 * speed);
}

async function memberName(m) {
  if (m.gameName) return m.gameName;
  const s = m.puuid ? await summonerByPuuid(m.puuid) : null;
  return s?.gameName || s?.displayName || m.summonerName || 'UNKNOWN RUNNER';
}

async function lobbyNames() {
  try {
    const lobby = await lcu('/lol-lobby/v2/lobby');
    const others = (lobby?.members || []).filter((m) => !m.isLocalMember);
    return Promise.all(others.map(memberName));
  } catch {
    return [];
  }
}

// opts (join): { whos: Promise<{ name, tag }>[] }. Everything starts at once;
// names are filled in when the lookups answer (well before they're shown).
// Returns a controller: join sequences can take more runners while running
// (add), until shortly before the stamp (accepting); done() once removed.
export function breach(mode = 'enter', opts = {}) {
  if (!settings.effects) return null;
  const started = Date.now();
  let removed = false;
  const [speed, size, bufN, segN, title] = MODES[mode];
  const at = (ms, fn) => setTimeout(fn, ms * speed);
  const tint = mode === 'leave' ? 'red' : pick(['yellow', 'yellow', 'cyan']);
  markBusy(5400 * speed);
  const names = [];
  if (mode === 'enter') lobbyNames().then((n) => names.push(...n));
  const runners = []; // resolved { name, tag } for join
  let logStarted = false;

  const cells = Array.from({ length: size * size }, () => h('span', { class: 'cc-bp-cell' }, pick(CODES)));
  const matrix = h('div', { class: 'cc-bp-matrix', style: `grid-template-columns:repeat(${size}, 38px)` }, ...cells);
  const path = [];
  let r = 0;
  let c = Math.floor(rand(0, size));
  for (let i = 0; i < bufN + 2 && path.length < bufN; i++) {
    if (i % 2 === 0) r = Math.floor(rand(0, size));
    else c = Math.floor(rand(0, size));
    const idx = r * size + c;
    if (!path.includes(idx)) path.push(idx);
  }
  const buffer = h('div', { class: 'cc-bp-buffer' }, ...Array.from({ length: bufN }, () => h('span')));
  const log = h('div', { class: 'cc-bp-log' });
  const pct = h('span', { class: 'cc-bp-pct' }, mode === 'leave' ? '100%' : '000%');
  const bar = segmented(segN);
  // the robot voice says these, so the stamp shows the same words while it's on
  const voice = settings.robotVoice !== false && { enter: ['LINK ESTABLISHED', 'voice-link'], leave: ['SIGNAL LOST', 'voice-signal'] }[mode];
  const stampText = mode === 'join' ? '…' : voice ? voice[0] : pick(STAMPS[mode]);
  const stampMain = h('span', { class: 'cc-bp-stamp-text', 'data-text': stampText }, stampText);
  const stampTag = h('span', { class: 'cc-bp-stamp-tag' });
  const stamp = h('div', { class: 'cc-bp-stamp' },
    mode === 'join' && h('span', { class: 'cc-bp-stamp-kicker' }, 'LINK ESTABLISHED'),
    stampMain,
    mode === 'join' && stampTag);
  // one runner: their name + #tag; several: "N RUNNERS LINKED" + the names
  const drawStamp = () => {
    if (!runners.length) return;
    const one = runners.length === 1;
    const text = one ? runners[0].name : `${runners.length} RUNNERS LINKED`;
    stampMain.textContent = text;
    stampMain.dataset.text = text;
    stampTag.textContent = one ? (runners[0].tag ? `#${runners[0].tag}` : '') : runners.map((r) => r.name).join('  //  ');
    stamp.classList.toggle('many', !one);
  };
  const addRunners = (promises) => {
    for (const p of promises) {
      p.then((w) => {
        if (removed) return;
        runners.push(w);
        drawStamp();
        if (logStarted) typeLine(log, `> RUNNER: ${String(w.name).toUpperCase()}`, '', speed);
      });
    }
  };

  const el = h('div', { class: `cc-bp tint-${tint} mode-${mode}` },
    h('div', { class: 'cc-bp-veil' }),
    h('div', { class: 'cc-bp-frame' },
      h('div', { class: 'cc-bp-head' },
        h('span', { class: 'cc-bp-title' }, title),
        h('span', { class: 'cc-bp-code' }, `SYS.${hexId()}`)),
      h('div', { class: 'cc-bp-body' },
        h('div', { class: 'cc-bp-col' }, h('div', { class: 'cc-bp-label' }, 'CODE MATRIX'), matrix),
        h('div', { class: 'cc-bp-col wide' },
          h('div', { class: 'cc-bp-label' }, 'BUFFER'), buffer,
          h('div', { class: 'cc-bp-label' }, 'LOG'), log)),
      h('div', { class: 'cc-bp-foot' }, h('span', { class: 'cc-bp-label' }, mode === 'leave' ? 'PURGING' : 'UPLOADING'), bar, pct)),
    stamp,
    h('div', { class: 'cc-bp-glitch' }, ...Array.from({ length: 8 }, () => h('i', { style: `--y:${rand(0, 96)}%;--h:${rand(2, 22)}px;--x:${rand(-40, 40)}px` }))));
  el.style.setProperty('--speed', speed);
  document.body.append(el);
  if (mode === 'enter') playSound('create');
  if (mode === 'leave') playSound('disconnect');

  // cells pop in as a diagonal wave (row + column), not one by one
  cells.forEach((cell, i) => at(500 + (Math.floor(i / size) + (i % size)) * 40, () => cell.classList.add('in')));
  // selection cursor (theme.css "Breach v2"): glides to each pick, alternating
  // row / column like the real minigame. Cell 38x30 + 4px gap.
  const sel = h('i', { class: 'cc-bp-sel' });
  matrix.append(sel);
  const aim = (idx, i) => {
    const row = Math.floor(idx / size), col = idx % size;
    sel.style.cssText = i % 2
      ? `--w:${size * 42 - 4}px;--h:30px;--tx:0px;--ty:${row * 34}px`
      : `--w:38px;--h:${size * 34 - 4}px;--tx:${col * 42}px;--ty:0px`;
  };
  if (path.length) at(950, () => { aim(path[0], 0); sel.classList.add('on'); });
  path.forEach((idx, i) => at(1100 + i * 380, () => {
    aim(idx, i);
    cells[idx].classList.add(mode === 'leave' ? 'failed' : 'picked');
    const slot = buffer.children[i];
    if (slot) {
      slot.textContent = cells[idx].textContent;
      slot.classList.add('on');
    }
  }));

  if (mode === 'join') addRunners(opts.whos || []);

  // the log is decided just before it starts typing, so looked-up names are in;
  // runners resolved later type their own line when they arrive
  at(850, () => {
    logStarted = true;
    const runner = mode === 'join' ? runners.map((w) => `> RUNNER: ${String(w.name).toUpperCase()}`) : names.map((n) => `> RUNNER LINKED: ${String(n).toUpperCase()}`);
    const closing = { enter: '> UPLINK STABLE', join: '> NODE ONLINE', leave: '> LINK TERMINATED' }[mode];
    const lines = [...pick(LOGS[mode]), ...runner, closing];
    lines.forEach((line, i) => setTimeout(() => typeLine(log, line, i === lines.length - 1 ? 'ok' : '', speed), (50 + i * (2400 / lines.length)) * speed));
  });

  // upload fills (or, when leaving, drains)
  const segs = [...bar.children];
  if (mode === 'leave') segs.forEach((s) => s.classList.add('on'));
  segs.forEach((s, i) => at(1000 + (2700 / segs.length) * (i + 1), () => {
    if (mode === 'leave') segs[segs.length - 1 - i].classList.remove('on');
    else s.classList.add('on');
    const k = (i + 1) / segs.length;
    pct.textContent = `${String(Math.round((mode === 'leave' ? 1 - k : k) * 100)).padStart(3, '0')}%`;
  }));

  at(3900, () => el.classList.add('granted'));
  // spoken as the stamp hits (theme.css "Breach v2": impact ~340ms after granted)
  if (voice) setTimeout(() => playSound(voice[1]), 3900 * speed + 340);
  at(4700, () => el.classList.add('out'));
  at(5400, () => { el.remove(); removed = true; });

  return {
    add: addRunners,
    accepting: () => !removed && Date.now() - started < 3300 * speed,
    done: () => removed,
  };
}

export const playCyberware = () => breach('enter');

// Settings > Sound > Preview match found: the HUD + sound without queueing
export function previewMatchFound() {
  playSound('matchfound');
  matchFoundFx({ preview: true });
}

// match found: Cyberpunk netrunner HUD around the ready check circle (styles: theme.css
// "Match found v3"). Intro timed to assets/sounds/matchfound.wav: impact at 0 ms (flash,
// RGB glitch slices, angular frame draws on, MATCH FOUND tag), 10 Hz pulses until ~1450 ms
// (scanner sweep, SYNC bar fills one segment per pulse, log types the real queue / map).
// Then it STAYS for the whole ready check: our countdown ring (Riot's timer video is
// hidden) and the TIME bar drain with the real timer (/lol-matchmaking/v1/ready-check
// sends `timer` = whole seconds elapsed, 0..13), the centre shows the seconds left, the
// tag follows your answer. It hard-cuts out when the ready check ends (phase change).
// Voice "Match found" (voice-match.wav) at 300 ms, over the quiet pulses.
const LOCK_MS = 1450;
const PULSES = 13;
const RC_TOTAL = 12000;   // accept window; the client gives up at ~13 s, so we hit 0 slightly early
const TICKS = 48;         // countdown ring segments
const HEX = '0123456789ABCDEF';
const hex = (n) => Array.from({ length: n }, () => HEX[Math.floor(Math.random() * 16)]).join('');
let hud = null;           // the HUD currently on screen: { update(readyCheck), end() }

function glitchSlices(n) {
  return h('div', { class: 'cc-mf-slices' }, ...Array.from({ length: n }, () => h('i', {
    style: `--y:${(Math.random() * 96).toFixed(1)}%;--h:${(2 + Math.random() * 26).toFixed(0)}px;--x:${(Math.random() * 80 - 40).toFixed(0)}px;--dl:${(Math.random() * 0.12).toFixed(2)}s`,
  })));
}

function matchFoundFx({ preview = false } = {}) {
  if (!settings.effects) return;
  hud?.end();
  markBusy(2300);
  const tagText = h('span', { 'data-text': 'MATCH FOUND' }, 'MATCH FOUND');
  const tag = h('div', { class: 'cc-mf-tag' }, tagText);
  const log = h('div', { class: 'cc-mf-log' });
  const pct = h('b', {}, '000');
  const unit = h('span', {}, '%');
  const ptitle = h('div', { class: 'cc-mf-ptitle' }, 'SYNC');
  const segs = Array.from({ length: PULSES }, () => h('i'));
  const right = h('div', { class: 'cc-mf-panel right' }, ptitle, h('div', { class: 'cc-mf-sync' }, ...segs), h('div', { class: 'cc-mf-pct' }, pct, unit));
  const ring = h('i', { class: 'cc-mf-time' });
  const count = h('div', { class: 'cc-rc-count' }, h('b', {}, '12.0'), h('small', {}, 'SEC'));
  const el = h('div', { class: 'cc-mf' },
    h('i', { class: 'cc-mf-dim' }),
    h('i', { class: 'cc-mf-flash' }),
    glitchSlices(9),
    h('div', { class: 'cc-mf-rig' },
      h('i', { class: 'cc-mf-cross h' }), h('i', { class: 'cc-mf-cross v' }),
      h('i', { class: 'cc-mf-wave' }),
      // the rings stay clear of Riot's Accept / Decline buttons (gap at the bottom)
      h('div', { class: 'cc-mf-gap' }, h('i', { class: 'cc-mf-arc a1' })),
      ring,
      h('div', { class: 'cc-mf-scanbox' }, h('i', { class: 'cc-mf-scan' })),
      tag,
      h('div', { class: 'cc-mf-panel left' }, h('div', { class: 'cc-mf-ptitle' }, '// NET INTERCEPT'), log),
      right));

  // real queue / map names for the log (falls back if the session isn't there yet)
  const info = { queue: 'MATCHMADE', map: 'UNKNOWN SECTOR' };
  if (!preview) {
    lcu('/lol-gameflow/v1/session').then((s) => {
      info.queue = s?.gameData?.queue?.description || s?.gameData?.queue?.shortName || info.queue;
      info.map = s?.map?.name || info.map;
    }).catch(() => {});
  }
  const lines = () => [
    '> SIGNAL INTERCEPTED',
    `> QUEUE: ${info.queue}`,
    `> SECTOR: ${info.map}`,
    `> MATCH ID: ${hex(2)}-${hex(2)}-${hex(2)}`,
    '> ROUTING ...... OK',
  ];

  // ---- countdown, kept in sync with the client's timer ----
  let t0 = performance.now();
  let lastTimer = null;
  let rc = { playerResponse: 'None', state: 'InProgress' };
  let locked = false;
  let ended = false;
  let ticker = 0;
  const setTag = (text) => {
    if (tagText.dataset.text === text) return;
    tagText.textContent = text;
    tagText.dataset.text = text;
  };
  const drawTag = () => {
    if (!locked) return;
    if (rc.playerResponse === 'Declined') setTag('DECLINED');
    else if (rc.state === 'EveryoneReady') setTag('ALL RUNNERS READY');
    else if (rc.playerResponse === 'Accepted') setTag('ACCEPTED // STANDBY');
    else setTag('AWAITING INPUT');
  };
  const update = (d) => {
    if (ended || !d) return;
    if (typeof d.timer === 'number') {
      // timer is whole seconds: re-anchor when it ticks over (that moment is exact)
      if (lastTimer === null || d.timer !== lastTimer) t0 = performance.now() - d.timer * 1000;
      lastTimer = d.timer;
    }
    rc = { ...rc, ...d };
    el.classList.toggle('accepted', rc.playerResponse === 'Accepted');
    el.classList.toggle('declined', rc.playerResponse === 'Declined');
    el.classList.toggle('ready', rc.state === 'EveryoneReady');
    drawTag();
  };
  const tick = () => {
    const left = Math.max(0, 1 - (performance.now() - t0) / RC_TOTAL);
    ring.style.setProperty('--left', (Math.ceil(left * TICKS) / TICKS).toFixed(4));
    const secs = (left * RC_TOTAL) / 1000;
    count.firstChild.textContent = secs.toFixed(1).padStart(4, '0');
    const low = secs <= 3 && rc.playerResponse === 'None';
    el.classList.toggle('low', low);
    count.classList.toggle('low', low);
    count.classList.toggle('accepted', rc.playerResponse === 'Accepted');
    count.classList.toggle('declined', rc.playerResponse === 'Declined');
    if (locked) {
      const on = Math.ceil(left * PULSES);
      segs.forEach((s, i) => s.classList.toggle('on', i < on));
      pct.textContent = secs.toFixed(1).padStart(4, '0');
    }
    // the seconds take the game-mode icon's place (Riot may re-render it)
    const icon = document.querySelector('.ready-check-map-icon');
    if (icon && count.parentElement !== icon) icon.append(count);
  };
  const end = () => {
    if (ended) return;
    ended = true;
    clearInterval(ticker);
    count.remove();
    if (hud === ctl) hud = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 400);
  };
  const ctl = { update, end };
  hud = ctl;
  if (!preview) lcu('/lol-matchmaking/v1/ready-check').then(update).catch(() => {});
  setTimeout(end, preview ? RC_TOTAL + 400 : 20000);  // safety net if no phase change arrives

  // centre on the ready check circle; it renders a frame or two after the phase change
  let tries = 0;
  const start = () => {
    if (ended) return;
    const box = document.querySelector('.ready-check-map-background') || document.querySelector('.ready-check-root-element');
    const r = box?.getBoundingClientRect();
    if ((!r || !r.width) && tries++ < 6) return requestAnimationFrame(start);
    const x = r?.width ? r.left + r.width / 2 : innerWidth / 2;
    const y = r?.width ? r.top + r.height / 2 : innerHeight / 2;
    const rad = Math.min(260, Math.max(150, (r?.width || 410) / 2));
    el.style.cssText = `--x:${x}px;--y:${y}px;--r:${rad}px;--d:${rad + 34}px`;
    document.body.append(el);
    if (settings.robotVoice !== false) setTimeout(() => !ended && playSound('voice-match'), 300);
    tick();
    ticker = setInterval(tick, 100);

    const s0 = performance.now();
    let pulse = -1;
    let typed = 0;
    const intro = (t) => {
      if (ended) return;
      const ms = t - s0;
      const k = Math.min(1, Math.max(0, (ms - 150) / (LOCK_MS - 150)));
      pct.textContent = String(Math.round((1 - (1 - k) ** 2) * 100)).padStart(3, '0');
      const p = Math.min(PULSES, Math.floor((ms - 150) / 100) + 1);
      while (pulse < p - 1) segs[++pulse]?.classList.add('on');
      const due = Math.min(5, Math.floor((ms - 200) / 250) + 1);
      while (typed < due) {
        log.append(h('div', { class: typed === 4 ? 'ok' : '' }, lines()[typed]));
        typed += 1;
      }
      if (ms < LOCK_MS) return requestAnimationFrame(intro);
      // locked: the SYNC panel becomes the TIME bar, the tag shows your state
      locked = true;
      ptitle.textContent = 'TIME';
      unit.textContent = 's';
      right.classList.add('timer');
      el.append(glitchSlices(7));
      el.classList.add('locked');
      drawTag();
      tick();
    };
    requestAnimationFrame(intro);
  };
  start();
  glitchTitle();
}

// the ready check title glitches (styles: theme.css "Match found glitch"). Riot re-renders it when
// its text changes (match found -> accepted), so keep tagging it while the ready check is open.
let titleTimer = null;
function glitchTitle() {
  clearInterval(titleTimer);
  const until = Date.now() + 20000;
  titleTimer = setInterval(() => {
    if (Date.now() > until) return stopGlitchTitle();
    for (const el of document.querySelectorAll('.ready-check-status-title')) {
      const text = el.textContent.trim();
      if (el.dataset.text === text) continue;
      el.dataset.text = text;
      el.classList.add('cc-mf-title');
      el.classList.remove('cc-mf-boot');
      void el.offsetWidth;  // restart the boot burst for the new text
      el.classList.add('cc-mf-boot');
    }
  }, 150);
}
function stopGlitchTitle() {
  clearInterval(titleTimer);
  titleTimer = null;
}

// Lobby events, ignoring the client's blips: locking the lobby or a declined
// queue can briefly rebuild the lobby (members re-sent, phase flickering).
// onLobby: called on every lobby update (before Riot re-renders) and every second in a lobby
export function initCyberware(context, onJoin, onLeave, onLobby, onNewParty) {
  let phase = null;
  let leaveTimer = null;
  let lastEnter = 0;
  let lastLeave = 0;
  let partyId; // undefined until the first lobby update; null after you left one

  // Leaving a lobby (yours or someone else's) is seen two ways: the phase drops to None
  // from any lobby phase (also mid-queue: Matchmaking -> None), or the lobby itself is
  // deleted. Either one starts the same check; it plays once you have really been out
  // for a moment (lobby rebuild blips come back within it), and only once per leave.
  const IN_LOBBY = new Set(['Lobby', 'Matchmaking', 'ReadyCheck']);
  const scheduleLeave = () => {
    if (leaveTimer) return;
    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      // back in the menus (a deleted lobby alone is not enough: Riot also drops it when
      // a game starts)
      const out = phase === 'None' || phase === null;
      if (!out || Date.now() - lastLeave < 3000) return;
      lastLeave = Date.now();
      partyId = null;  // so rejoining the same lobby counts as entering it again
      breach('leave');
    }, 900);
  };
  const cancelLeave = () => {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  };

  // the plugin can be (re)loaded while you are already in a lobby: know the phase
  lcu('/lol-gameflow/v1/gameflow-phase').then((p) => { if (phase === null) phase = p; }).catch(() => {});

  // ready check timer / your answer -> the match found HUD's countdown and tag
  context.socket.observe('/lol-matchmaking/v1/ready-check', ({ data }) => hud?.update(data));

  context.socket.observe('/lol-gameflow/v1/gameflow-phase', ({ data }) => {
    const prev = phase;
    phase = data;
    if (data === 'ReadyCheck' && prev !== 'ReadyCheck') matchFoundFx();
    if (data !== 'ReadyCheck') {
      stopGlitchTitle();
      hud?.end();
    }
    if (IN_LOBBY.has(prev) && data === 'None') {
      scheduleLeave();
      return;
    }
    // entering from the menus (not coming back from queue / a game / a blip)
    if (data === 'Lobby' && (prev === 'None' || prev === null)) {
      if (leaveTimer) {  // it was a blip: back in the same lobby
        cancelLeave();
        return;
      }
      if (Date.now() - lastEnter > 6000) {
        lastEnter = Date.now();
        breach('enter');
      }
    }
  });

  // joins: someone counts as new only if they weren't in this party in the last
  // 10s; a new party (you created / joined one) only records who is there
  let quietUntil = 0;
  const seen = new Map(); // puuid -> last time present
  let lastPresent = new Set();
  idleInterval(() => { if (phase === 'Lobby') onLobby?.(); }, 1000);
  context.socket.observe('/lol-lobby/v2/lobby', ({ data }) => {
    if (!data?.members) {
      // your lobby was deleted (you left it, or were removed from it)
      if (partyId) scheduleLeave();
      return;
    }
    if (data.partyId === partyId) cancelLeave();  // same lobby back: it was a blip
    onLobby?.();
    const now = Date.now();
    const present = new Set(data.members.map((m) => m.puuid));
    if (data.partyId !== partyId) {
      // a party you just created / joined: hold the page until its cosmetics are on
      if (partyId !== undefined) onNewParty?.();
      // a new party you just created / joined: start the entry right away
      // (the gameflow phase arrives later); the phase handler won't repeat it
      if (partyId !== undefined && Date.now() - lastEnter > 6000) {
        lastEnter = Date.now();
        breach('enter');
      }
      partyId = data.partyId;
      seen.clear();
      for (const p of present) seen.set(p, now);
      lastPresent = present;
      quietUntil = now + 2500;
      return;
    }
    for (const m of data.members) {
      const isNew = !seen.has(m.puuid);
      seen.set(m.puuid, now);
      if (isNew && now > quietUntil && !m.isLocalMember && m.puuid !== me.puuid && settings.effects) onJoin(m);
    }
    // leaves: in the last update, gone now (cards decode away backwards)
    for (const p of lastPresent) if (!present.has(p) && p !== me.puuid && settings.effects) onLeave?.(p);
    lastPresent = present;
    for (const [p, t] of seen) if (!present.has(p) && now - t > 10000) seen.delete(p);
  });
}
