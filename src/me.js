// Who you are, and whether a piece of the client shows *your* profile.

import { currentSummoner } from './api.js';

export const me = { puuid: null, summonerId: null, gameName: null };

currentSummoner()
  .then((s) => { me.puuid = s.puuid; me.summonerId = String(s.summonerId); me.gameName = s.gameName || s.displayName || null; })
  .catch(() => {});

// Your own profile opens either as the main profile screen or, when you click
// your own card / name, in the same overlay used for other players. Inside the
// overlay, ownership is decided by the regalia's puuid.
export function isMyProfile(el) {
  const overlay = el.closest('.rcp-fe-lol-profiles-modal');
  if (!overlay) return true;
  if (!me.puuid) return false;
  return !!overlay.querySelector(`[puuid="${me.puuid}"], [summoner-id="${me.summonerId}"]`);
}
