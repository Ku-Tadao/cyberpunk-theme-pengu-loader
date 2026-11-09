// Lobby invite sound: plays assets/sounds/invite.wav when someone invites you.
// The socket sends the whole received-invitations list on every change, so an
// invite is "new" when its id hasn't been seen yet and it is still pending.
// Invites already waiting when the client starts don't ring. Riot's own invite
// sound is silenced in sounds.js so they don't double up.

import { lcu } from './api.js';
import { playSound } from './sounds.js';

const PATH = '/lol-lobby/v2/received-invitations';

export function initInvites(context) {
  const seen = new Set();
  lcu(PATH).then((list) => { for (const i of list || []) seen.add(i.invitationId); }).catch(() => {});

  context.socket.observe(PATH, ({ data }) => {
    if (!Array.isArray(data)) return;
    let ring = false;
    for (const inv of data) {
      if (!inv?.invitationId || seen.has(inv.invitationId)) continue;
      seen.add(inv.invitationId);
      if (inv.state === 'Pending') ring = true;
    }
    if (seen.size > 200) seen.clear();
    if (ring) playSound('invite');
  });
}
