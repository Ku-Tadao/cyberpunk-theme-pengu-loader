// Keeps every custom picture in use decoded in memory (icon, border, banner, profile
// background, wallpaper), so when a page or card adds one it draws on its first frame
// instead of loading in after the loading cover has lifted. Follows the settings.

import { settings, subscribe } from './store.js';
import { fileUrl, wallpaperUrl, isVideo } from './assets.js';

const kept = new Map(); // url -> decoded Image (the reference keeps it in the image cache)

function wanted() {
  const list = [
    settings.customIcon && fileUrl('icons', settings.customIcon),
    settings.borderImage && fileUrl('borders', settings.borderImage),
    settings.customBanner && fileUrl('banners', settings.customBanner),
    settings.profileBg && !isVideo(settings.profileBg) && fileUrl('profileBgs', settings.profileBg),
    settings.wallpaper && !isVideo(settings.wallpaper) && wallpaperUrl(settings.wallpaper),
  ];
  return new Set(list.filter(Boolean));
}

function sync() {
  const want = wanted();
  for (const url of kept.keys()) if (!want.has(url)) kept.delete(url);
  for (const url of want) {
    if (kept.has(url)) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img.decode().catch(() => {});
    kept.set(url, img);
  }
}

export function startPreload() {
  sync();
  // file lists change too: a replaced file gets a new (stamped) url
  subscribe(sync);
}
