// Chat sounds + the private-message icon animation.
// Pengu's socket listens by prefix, so /lol-chat/v1/conversations also receives
// every new message (/lol-chat/v1/conversations/<id>/messages/<msg>). Message
// type "chat" is a private message; "groupchat" is lobby / champ select.
// Sounds: dm-in / dm-out / lobby-in / lobby-out (assets/sounds). Riot's own
// "message received" sound is silenced in sounds.js so they don't double up.

import { settings } from './store.js';
import { me } from './me.js';
import { playSound } from './sounds.js';

const MESSAGE = /\/lol-chat\/v1\/conversations\/[^/]+\/messages\/[^/]+$/;

function fromMe(m) {
  return (me.summonerId && String(m.fromSummonerId) === me.summonerId)
    || (me.puuid && (m.fromId === me.puuid || String(m.fromPid || '').startsWith(me.puuid)));
}

// the chat button at the bottom of the friends panel: a short pulse + bounce
function pingIcon() {
  if (!settings.effects) return;
  for (const btn of document.querySelectorAll('.lol-social-chat-toggle-button')) {
    btn.classList.remove('cc-dm-ping');
    void btn.offsetWidth; // restart the animation
    btn.classList.add('cc-dm-ping');
    clearTimeout(btn.ccPingTimer);
    btn.ccPingTimer = setTimeout(() => btn.classList.remove('cc-dm-ping'), 2200);
  }
}

export function initChat(context) {
  const seen = new Set();
  context.socket.observe('/lol-chat/v1/conversations', ({ uri, eventType, data }) => {
    if (eventType !== 'Create' || !MESSAGE.test(uri || '') || !data || data.isHistorical) return;
    if (data.type !== 'chat' && data.type !== 'groupchat') return; // system / celebration
    if (seen.has(data.id)) return;
    seen.add(data.id);
    if (seen.size > 500) seen.clear();

    const dm = data.type === 'chat';
    const mine = fromMe(data);
    playSound(`${dm ? 'dm' : 'lobby'}-${mine ? 'out' : 'in'}`);
    if (dm && !mine) pingIcon();
  });
}
