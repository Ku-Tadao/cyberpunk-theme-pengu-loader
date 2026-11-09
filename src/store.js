const KEY = 'cc-settings-v3';
const DEFAULTS = {
  wallpaper: '',        // file name in assets/wallpapers (or a URL)
  wallpapers: [],       // synced file names per folder
  icons: [],
  customIcon: '',       // file name in assets/icons, local-only profile picture
  profileBgs: [],
  profileBg: '',        // file name in assets/profile-backgrounds, local-only
  customTitle: '',      // local-only title under your name
  titleStyle: 'glitch',
  iconBorder: '',       // local-only animated border around your icon
  banners: [],
  customBanner: '',     // file name in assets/banners, local-only
  borders: [],
  borderImage: '',      // file name in assets/borders: an image frame around your icon
  status: '',           // '' = real status, else chat / ingame / away / mobile / offline
  rankQueue: 'RANKED_SOLO_5x5', // presence overrides (friends see these in hover cards)
  rankTier: '',
  rankDivision: 'I',
  masteryScore: '',
  crystalTier: '',
  challengePoints: '',
  inviteGroup: '',
  dim: 0.55,            // darkening over the wallpaper, 0..0.85
  style: 'cyberpunk',   // theme preset, see PRESETS in customize.js
  accent: '#fcee0a',
  accent2: '#ff003c',
  blur: 18,
  globalFont: true,     // swap Riot's fonts client-wide
  effects: true,        // scanlines / glow
  customSounds: true,   // cyberpunk sound pack (restart to apply)
  robotVoice: true,     // "Link established" / "Signal lost" voice on lobby create / leave
  pageGate: true,       // short loader while a new page gets its custom look
  lite: false,          // lightweight mode: no glass blur / moving scanlines (weaker PCs)
  friendsHidden: false, // friends panel slid off the right edge
  homeHidden: false,    // home page content slid off the left edge
  statusMessage: '',    // custom status text (presence)
  recolor: true,        // generated palette swap for every Riot screen
};

const old = DataStore.get('cc-settings-v2') || {};
const saved = DataStore.get(KEY) || {};
// settings saved before presets existed: move them onto the Cyberpunk look
if (!saved.style) delete saved.accent;

export const settings = {
  ...DEFAULTS,
  ...saved,
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function update(patch) {
  Object.assign(settings, patch);
  DataStore.set(KEY, settings);
  for (const fn of listeners) fn(patch);
}

export function reset(keys) {
  update(Object.fromEntries(keys.map((k) => [k, DEFAULTS[k]])));
}

export const toast = {
  ok: (msg) => window.Toast?.success?.(msg),
  err: (msg) => window.Toast?.error?.(msg),
};
