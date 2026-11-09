// User files dropped into the plugin's asset folders.
// Pengu can open a folder in Explorer but can't list it, so each folder has a
// "_Refresh list.cmd" that writes index.json; we poll that file.

import { settings, update } from './store.js';
import { idleInterval } from './perf.js';

const PLUGIN = decodeURIComponent(new URL(import.meta.url).pathname.split('/')[1]);

export const FOLDERS = {
  wallpapers: { path: 'assets/wallpapers', label: 'Wallpapers', key: 'wallpaper' },
  icons: { path: 'assets/icons', label: 'Profile pictures', key: 'customIcon' },
  profileBgs: { path: 'assets/profile-backgrounds', label: 'Profile backgrounds', key: 'profileBg' },
  banners: { path: 'assets/banners', label: 'Banners', key: 'customBanner' },
  borders: { path: 'assets/borders', label: 'Icon borders', key: 'borderImage' },
};

export const folderPath = (folder) => `plugins/${PLUGIN}/${FOLDERS[folder].path}`;

// last-modified stamps from index.json ("name|ticks"): a file replaced under the same
// name gets a new URL, so the client never shows the cached old picture
const stamps = {};

export const fileUrl = (folder, name) => {
  const v = stamps[folder]?.[name];
  return new URL(`../${FOLDERS[folder].path}/${encodeURIComponent(name)}${v ? `?v=${v}` : ''}`, import.meta.url).href;
};

export const wallpaperUrl = (value) =>
  /^(https?:|data:)/i.test(value) ? value : fileUrl('wallpapers', value);

export const isVideo = (name) => /\.(mp4|webm)$/i.test(name);
export const isAnimated = (name) => /\.(gif|mp4|webm|webp)$/i.test(name);

export function openFolder(folder) {
  window.openPluginsFolder?.(`${PLUGIN}/${FOLDERS[folder].path}`);
}

// Reads index.json; returns null when it doesn't exist yet.
async function readIndex(folder) {
  try {
    const res = await fetch(new URL(`../${FOLDERS[folder].path}/index.json`, import.meta.url), { cache: 'no-store' });
    if (!res.ok) return null;
    const list = await res.json();
    return Array.isArray(list) ? list.filter((n) => typeof n === 'string') : null;
  } catch {
    return null;
  }
}

export async function refresh(folder) {
  const entries = await readIndex(folder);
  if (!entries) return false;
  const next = {};
  const list = entries.map((e) => {
    const [name, v] = e.split('|');
    if (v) next[name] = v;
    return name;
  });
  const replaced = JSON.stringify(next) !== JSON.stringify(stamps[folder] || {});
  stamps[folder] = next;
  if (replaced || list.join('\n') !== settings[folder].join('\n')) {
    // the folder key is always in the patch so galleries and the wallpaper re-render
    const patch = { [folder]: list };
    const key = FOLDERS[folder].key;
    if (settings[key] && !/^(https?:|data:)/i.test(settings[key]) && !list.includes(settings[key])) patch[key] = '';
    update(patch);
  }
  return true;
}

// Poll a folder while `el` is on screen (pages are cached and re-attached, so keep the timer).
export function watch(folder, el, onStatus) {
  const tick = async () => {
    if (el.isConnected) onStatus?.(await refresh(folder));
  };
  idleInterval(tick, 2500);
  setTimeout(tick);
}

export const refreshAll = () => Promise.all(Object.keys(FOLDERS).map(refresh));

// keep every folder current in the background (new, removed or replaced files show up
// within a few seconds, no plugin reload); index.json is tiny and fetched uncached
// resolves after the first check, once file urls carry their stamps
export function startAssetSync() {
  idleInterval(refreshAll, 3000);
  return refreshAll();
}
