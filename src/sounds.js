// Sound pack: the client loads every UI sound effect through XMLHttpRequest
// (rcp-fe-audio) and decodes it with Web Audio, so requests for sfx-*.ogg are
// redirected to our soft WAVs (assets/sounds) by category. Music and voice
// lines are left alone. All our sounds are preloaded into memory (blob URLs)
// so the client gets them instantly. Patches at import time, before the client
// loads its sounds. Toggle: settings.customSounds (checked on every request).

const BASE = new URL('../assets/sounds/', import.meta.url).href;
const KEYS = ['silence', 'transition', 'create', 'returned', 'matchfound', 'queue', 'champselect', 'lockin', 'levelup', 'disconnect', 'dm-in', 'dm-out', 'lobby-in', 'lobby-out', 'invite', 'node-join', 'node-leave', 'voice-link', 'voice-signal', 'voice-match'];

// first match wins. Every event has its own sound; clicks, hovers and
// notifications are silent.
const RULES = [
  [/hover/i, 'silence'],
  [/chat-message|message-receive/i, 'silence'], // chat.js plays its own
  [/find-match-click/i, 'queue'],
  [/readycheck-(lowspec-intro|ringmagic-countdown|intro)/i, 'matchfound'],
  [/gameselect-trans-to-lobby/i, 'create'],
  [/player-returned/i, 'returned'],
  // cards appearing (yours too, and on every lobby refresh): silent; joinfx.js plays the
  // join blip only when someone else joins
  [/banner-intro|member|joined|join-chat|banner-invited/i, 'silence'],
  [/cs-lockin-button-click|clash-player-lockin/i, 'lockin'],
  [/cs-draft-(pick-intro|10ban-intro)/i, 'champselect'],
  [/levelup-postgame|level-up/i, 'levelup'],
  [/notif|invite|chat-message|captain|receive|rcvd|granted|yourpick|yourban|yourturn/i, 'silence'],
  [/trans-|transition/i, 'transition'],
  [/click|button|toggle|select|drop|drag|press|swap|grid|lockin|accept|decline|queue|quit|leave|open|intro|outro/i, 'silence'],
];

function enabled() {
  try {
    const s = DataStore.get('cc-settings-v3');
    return !s || s.customSounds !== false;
  } catch {
    return true;
  }
}

export function soundFor(url) {
  if (typeof url !== 'string' || !/\/sfx-[^/?#]*\.(ogg|wav)/i.test(url)) return null;
  const name = url.split('/').pop();
  for (const [re, key] of RULES) if (re.test(name)) return key;
  return null;
}

// in-memory copies: no file loading when the client asks for a sound
const blobs = {};
for (const key of KEYS) {
  fetch(`${BASE}${key}.wav`)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => { if (b) blobs[key] = URL.createObjectURL(b); })
    .catch(() => {});
}
const urlFor = (key) => blobs[key] || `${BASE}${key}.wav`;

const open = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  const key = enabled() ? soundFor(url) : null;
  return open.call(this, method, key ? urlFor(key) : url, ...rest);
};

// play one of our sounds directly
const players = {};
export function playSound(key, volume = 1) {
  if (!enabled()) return;
  const a = (players[key] ??= new Audio(urlFor(key)));
  try {
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch {}
}
