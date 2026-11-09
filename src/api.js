// Thin wrapper over the LCU API (the client proxies it on its own origin).

export async function lcu(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const put = (path, body) => lcu(path, { method: 'PUT', body: JSON.stringify(body) });
export const post = (path, body) => lcu(path, { method: 'POST', body: body && JSON.stringify(body) });

export const currentSummoner = () => lcu('/lol-summoner/v1/current-summoner');

export const riotId = (s) =>
  s?.gameName ? `${s.gameName}#${s.tagLine}` : s?.displayName || 'Unknown player';

export const profileIcon = (id) => `/lol-game-data/assets/v1/profile-icons/${id}.jpg`;

const summoners = new Map();
export function summonerByPuuid(puuid) {
  if (!summoners.has(puuid)) {
    summoners.set(puuid,
      lcu(`/lol-summoner/v2/summoners/puuid/${puuid}`)
        .catch(() => lcu(`/lol-summoner/v1/summoners-by-puuid-cached/${puuid}`))
        .catch(() => null));
  }
  return summoners.get(puuid);
}

// TFT static data (units, traits, items/augments) keyed by lowercase API id.
let tft;
export function tftStatic() {
  tft ??= Promise.all([
    lcu('/lol-game-data/assets/v1/tftchampions.json').catch(() => []),
    lcu('/lol-game-data/assets/v1/tfttraits.json').catch(() => []),
    lcu('/lol-game-data/assets/v1/tftitems.json').catch(() => []),
  ]).then(([champs, traits, items]) => {
    const units = new Map();
    for (const c of champs || []) {
      const r = c.character_record || c;
      const id = r.character_id || c.name;
      if (id) units.set(id.toLowerCase(), { name: r.display_name || c.name, icon: r.squareIconPath || c.squareIconPath });
    }
    return {
      units,
      traits: new Map((traits || []).filter((t) => t.trait_id)
        .map((t) => [t.trait_id.toLowerCase(), { name: t.display_name, icon: t.icon_path }])),
      items: new Map((items || []).filter((i) => i.nameId)
        .map((i) => [i.nameId.toLowerCase(), { name: i.name, icon: i.squareIconPath }])),
    };
  });
  return tft;
}
