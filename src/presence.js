// Custom rank / mastery score / challenge crystal in your chat presence (the
// data friends' hover cards read), the same way ElainaV4 does it. Riot
// rewrites presence now and then, so we re-apply whenever it drifts.

import { lcu, put } from './api.js';
import { settings, subscribe, toast } from './store.js';

export const QUEUES = [['RANKED_SOLO_5x5', 'Solo/Duo'], ['RANKED_FLEX_SR', 'Flex'], ['RANKED_TFT', 'TFT']];
export const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
export const DIVISIONS = ['I', 'II', 'III', 'IV'];
const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];

function wanted() {
  const lol = {};
  if (settings.rankTier) {
    lol.rankedLeagueQueue = settings.rankQueue;
    lol.rankedLeagueTier = settings.rankTier;
    lol.rankedLeagueDivision = APEX.includes(settings.rankTier) ? 'NA' : settings.rankDivision;
  }
  if (settings.masteryScore) lol.masteryScore = String(settings.masteryScore);
  if (settings.crystalTier) lol.challengeCrystalLevel = settings.crystalTier;
  if (settings.challengePoints) lol.challengePoints = String(settings.challengePoints);
  return lol;
}

export const STATUSES = [['', 'Real'], ['chat', 'Online'], ['ingame', 'In game'], ['away', 'Away'], ['mobile', 'Mobile'], ['offline', 'Offline']];

const differs = (current, want) => Object.entries(want).some(([k, v]) => String(current?.[k]) !== String(v));

// While you're really queueing, picking or playing, friends see that instead of the
// chosen status (Offline stays hidden, as with Riot's own menu); it comes back after.
const BUSY = {
  Matchmaking: 'inQueue', ReadyCheck: 'inQueue', ChampSelect: 'championSelect',
  GameStart: 'inGame', InProgress: 'inGame', Reconnect: 'inGame',
};
let phase = null;
const busy = () => phase in BUSY && settings.status !== 'offline';

// availability + a matching game status
function wantedStatus() {
  if (busy()) return null;
  switch (settings.status) {
    case 'ingame': return { availability: 'dnd', gameStatus: 'inGame' };
    case 'chat': return { availability: 'chat', gameStatus: 'outOfGame' };
    case 'away': case 'offline': return { availability: settings.status, gameStatus: 'outOfGame' };
    case 'mobile': return { availability: 'mobile' };
    default: return null;
  }
}

async function push(current, me) {
  const want = wanted();
  const status = wantedStatus();
  if (status?.gameStatus) want.gameStatus = status.gameStatus;
  const statusOff = status && (!me || me.availability !== status.availability);
  const message = settings.statusMessage;
  const messageOff = message && (!me || me.statusMessage !== message);
  if (!statusOff && !messageOff && (!Object.keys(want).length || (current && !differs(current, want)))) return;
  try {
    const body = status ? { availability: status.availability, lol: want } : { lol: want };
    if (message) body.statusMessage = message;
    await put('/lol-chat/v1/me', body);
  } catch (e) {
    console.warn('[CustomClient] presence', e);
  }
}

// Riot may have written the real game status just before we saw the phase change
// (and push() reverted it), so put it back once
async function showActivity() {
  try {
    await put('/lol-chat/v1/me', { availability: 'dnd', lol: { gameStatus: BUSY[phase] } });
  } catch (e) {
    console.warn('[CustomClient] presence', e);
  }
}

function setPhase(next) {
  const was = busy();
  phase = next;
  if (busy() && !was && settings.status) showActivity();
  else if (!busy() && was) push();
}

export function initPresence(context) {
  context.socket.observe('/lol-chat/v1/me', ({ data }) => { if (data?.lol) push(data.lol, data); });
  context.socket.observe('/lol-gameflow/v1/gameflow-phase', ({ data }) => setPhase(data));
  lcu('/lol-gameflow/v1/gameflow-phase').then((p) => { if (phase === null) setPhase(p); }).catch(() => {});
}

export function startPresence() {
  setTimeout(() => push(), 5000);
  subscribe((patch) => {
    if (['rankTier', 'rankQueue', 'rankDivision', 'masteryScore', 'crystalTier', 'challengePoints', 'status', 'statusMessage'].some((k) => k in patch)) {
      push();
      toast.ok('Presence updated');
    }
  });
}

// Riot's own rank emblems on your profile (local display)
export function applyLocalRank(el) {
  if (!settings.rankTier) return;
  if (el.getAttribute('ranked-tier') !== settings.rankTier) el.setAttribute('ranked-tier', settings.rankTier);
  const div = APEX.includes(settings.rankTier) ? '' : settings.rankDivision;
  if (el.hasAttribute('ranked-division') && el.getAttribute('ranked-division') !== div) el.setAttribute('ranked-division', div);
}
