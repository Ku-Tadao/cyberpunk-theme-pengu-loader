import { h, icon, empty, timeAgo, duration, pageHead } from './ui.js';
import { lcu, currentSummoner, summonerByPuuid, riotId, profileIcon, tftStatic } from './api.js';
import { openProfile } from './profile.js';

const TFT_QUEUES = { 1090: 'Normal', 1100: 'Ranked', 1130: 'Hyper Roll', 1160: 'Double Up' };
const TFT_TYPES = { pairs: 'Double Up', turbo: 'Hyper Roll' };
const tftQueue = (g) => TFT_QUEUES[g.queue_id] || TFT_TYPES[g.tft_game_type] || 'TFT';

const cache = new Map();
function loadGames(mode, puuid, fresh) {
  const key = `${mode}:${puuid}`;
  if (fresh) cache.delete(key);
  if (!cache.has(key)) {
    const p = mode === 'tft'
      ? lcu(`/lol-match-history/v1/products/tft/${puuid}/matches?begin=0&count=20`)
        .then((r) => (r?.games || []).map((g) => ({ id: g.metadata?.match_id, ...g.json })))
      : lcu(`/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=19`)
        .then((r) => r?.games?.games || []);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}

export function createHistory() {
  const el = h('div', { class: 'cc-page cc-history' });
  const stack = []; // players being viewed; [0] is you
  let mode = 'tft';
  let renderId = 0;

  async function show() {
    if (stack.length) return;
    el.replaceChildren(empty('Loading…'));
    try {
      const s = await currentSummoner();
      stack.push({ puuid: s.puuid, name: riotId(s) });
      render();
    } catch (e) {
      el.replaceChildren(empty(`Couldn't load your summoner: ${e.message}`));
    }
  }

  function openPlayer(player) {
    if (player.puuid === stack[stack.length - 1].puuid) return;
    stack.push(player);
    render();
  }

  async function render(fresh = false) {
    const id = ++renderId;
    const player = stack[stack.length - 1];
    const list = h('div', { class: 'cc-list' }, empty('Loading…'));
    el.replaceChildren(
      pageHead(stack.length > 1 ? 'Player profile' : 'Match history', player.name,
        stack.length > 1 && h('button', { class: 'cc-btn', onclick: () => { stack.pop(); render(); } }, icon('back', 14), 'Back'),
        h('div', { class: 'cc-seg' }, ...['tft', 'lol'].map((m) =>
          h('button', { class: m === mode ? 'active' : '', onclick: () => { mode = m; render(); } }, m === 'tft' ? 'TFT' : 'LoL'))),
        h('button', { class: 'cc-btn-icon', title: 'Refresh', onclick: () => render(true) }, icon('refresh', 16))),
      list);
    el.scrollTop = 0;

    try {
      const [games, data] = await Promise.all([
        loadGames(mode, player.puuid, fresh),
        mode === 'tft' ? tftStatic() : null,
      ]);
      if (id !== renderId) return;
      const rows = games
        .map((g) => (mode === 'tft' ? tftGame(g, player.puuid, data, openPlayer) : lolGame(g)))
        .filter(Boolean);
      list.replaceChildren(...(rows.length ? rows : [empty('No games found')]));
    } catch (e) {
      if (id === renderId) list.replaceChildren(empty(`Couldn't load match history: ${e.message}`));
    }
  }

  return { el, show };
}

// ---------- TFT ----------

function tftGame(g, puuid, data, openPlayer) {
  const me = g.participants?.find((p) => p.puuid === puuid);
  if (!me) return null;

  const tier = me.placement === 1 ? 'first' : me.placement <= 4 ? 'top' : 'bottom';
  const card = h('div', { class: `cc-game ${tier}` });
  let detail = null;
  card.append(h('button', {
    class: 'cc-game-row',
    onclick: () => {
      card.classList.toggle('open', !detail);
      if (detail) { detail.remove(); detail = null; return; }
      detail = tftDetail(g, puuid, data, { openHistory: openPlayer, openProfile });
      card.append(detail);
    },
  },
    placeBadge(me.placement),
    h('div', { class: 'cc-game-meta' },
      h('strong', {}, tftQueue(g)),
      h('span', { class: 'cc-muted' }, `${timeAgo(g.game_datetime)} · ${duration(g.game_length)}`)),
    traitsEl(me.traits, data, 4),
    unitsEl(me.units, data),
    h('span', { class: 'cc-chevron' }, icon('chevron', 16))));
  return card;
}

// All players of a TFT game, best placement first. Works on raw match JSON and on
// the client's own (enriched) match objects. Clicking a name opens that player's
// history (openHistory) or, if not given, their client profile (openProfile).
export function tftDetail(g, puuid, data, { openHistory, openProfile }) {
  const players = [...(g.participants || [])].sort((a, b) => a.placement - b.placement);
  return h('div', { class: 'cc-detail' }, ...players.map((p) => {
    const player = () => ({ puuid: p.puuid, name: name.textContent === '…' ? 'Unknown player' : name.textContent });
    const name = h('button', {
      class: 'cc-player-name' + (p.puuid === puuid ? ' self' : ''),
      title: openHistory ? 'Open match history' : 'Open profile',
      onclick: (e) => { e.stopPropagation(); (openHistory || openProfile)(player()); },
    }, p.riotIdGameName ? `${p.riotIdGameName}#${p.riotIdTagline}` : '…');
    const avatar = h('img', { class: 'cc-avatar', alt: '' });
    summonerByPuuid(p.puuid).then((s) => {
      if (!s) return;
      if (!p.riotIdGameName) name.textContent = riotId(s);
      avatar.src = profileIcon(s.profileIconId);
    });

    return h('div', { class: 'cc-player' },
      placeBadge(p.placement),
      avatar,
      h('div', { class: 'cc-player-info' },
        name,
        h('span', { class: 'cc-muted' }, `Lvl ${p.level} · ${p.total_damage_to_players ?? 0} dmg`)),
      openHistory && openProfile && h('button', {
        class: 'cc-btn-icon cc-profile-btn', title: 'Open profile',
        onclick: (e) => { e.stopPropagation(); openProfile(player()); },
      }, icon('user', 14)),
      augmentsEl(p.augments, data),
      traitsEl(p.traits, data, 6),
      unitsEl(p.units, data));
  }));
}

function placeBadge(n) {
  const tier = n === 1 ? 'first' : n <= 4 ? 'top' : 'bottom';
  return h('div', { class: `cc-place ${tier}` }, h('small', {}, '#'), n);
}

function traitsEl(traits, data, max) {
  const active = (traits || [])
    .filter((t) => t.style > 0)
    .sort((a, b) => b.style - a.style || b.num_units - a.num_units)
    .slice(0, max);
  return h('div', { class: 'cc-traits' }, ...active.map((t) => {
    const info = data.traits.get(t.name?.toLowerCase());
    return h('div', { class: `cc-trait s${t.style}`, title: `${info?.name || t.name} (${t.num_units})` },
      info?.icon ? h('img', { src: info.icon, alt: '' }) : t.num_units);
  }));
}

function unitsEl(units, data) {
  return h('div', { class: 'cc-units' }, ...(units || []).map((u) => {
    const info = data.units.get(u.character_id?.toLowerCase());
    const label = info?.name || u.championName || (u.character_id || '?').replace(/^TFT\d+_/i, '');
    const src = info?.icon || u.iconPath;
    return h('div', { class: `cc-unit r${u.rarity ?? 0}`, title: label },
      h('div', { class: `cc-tier t${u.tier || 1}` }, ...Array.from({ length: u.tier || 1 }, () => h('i'))),
      src ? h('img', { src, alt: '' }) : h('span', {}, label.slice(0, 3)),
      h('div', { class: 'cc-items' }, ...(u.itemNames || []).map((n) => {
        const it = data.items.get(n.toLowerCase());
        return it?.icon && h('img', { src: it.icon, title: it.name, alt: '' });
      })));
  }));
}

function augmentsEl(augments, data) {
  return h('div', { class: 'cc-augments' }, ...(augments || []).map((a) => {
    // the client's own match objects already resolved augments to item records
    const info = a && typeof a === 'object'
      ? { icon: a.squareIconPath || a.iconPath, name: a.name }
      : data.items.get(String(a).toLowerCase());
    return info?.icon && h('img', { src: info.icon, title: info.name, alt: '' });
  }));
}

// ---------- LoL ----------

function lolGame(g) {
  const p = g.participants?.[0];
  if (!p) return null;
  const st = p.stats || {};
  return h('div', { class: `cc-game ${st.win ? 'first' : 'bottom'}` },
    h('div', { class: 'cc-game-row static' },
      h('div', { class: `cc-place ${st.win ? 'first' : 'bottom'}` }, st.win ? 'W' : 'L'),
      h('img', { class: 'cc-avatar', src: `/lol-game-data/assets/v1/champion-icons/${p.championId}.png`, alt: '' }),
      h('div', { class: 'cc-game-meta' },
        h('strong', {}, `${st.kills ?? 0} / ${st.deaths ?? 0} / ${st.assists ?? 0}`),
        h('span', { class: 'cc-muted' }, `${timeAgo(g.gameCreation)} · ${duration(g.gameDuration)}`))));
}
