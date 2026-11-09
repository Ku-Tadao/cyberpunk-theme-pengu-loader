// Local-only custom background for your own profile page: a layer (image or
// video) inside the profile backdrop, using the client's own fade mask.

import { h } from './ui.js';
import { settings, subscribe } from './store.js';
import { fileUrl, wallpaperUrl, isVideo } from './assets.js';
import { isMyProfile } from './me.js';
import { changeInterval } from './perf.js';

function apply() {
  // no profile background picked: your wallpaper replaces Riot's splash instead
  const name = settings.profileBg ? `bg:${settings.profileBg}` : settings.wallpaper ? `wp:${settings.wallpaper}` : '';
  for (const container of document.querySelectorAll('.style-profile-backdrop-container')) {
    if (!isMyProfile(container)) continue;
    let layer = container.querySelector(':scope > .cc-profile-bg');
    // a data attribute, not a class: the client rewrites class attributes
    if (name) container.dataset.ccProfileBg = '';
    else delete container.dataset.ccProfileBg;
    if (layer && layer.dataset.name === name) continue;
    layer?.remove();
    if (!name) continue;

    const file = name.slice(3);
    const src = name.startsWith('bg:') ? fileUrl('profileBgs', file) : wallpaperUrl(file);
    layer = h('div', { class: 'cc-profile-bg' }, isVideo(file)
      ? h('video', { muted: true, autoplay: true, loop: true, playsInline: true, src })
      : h('img', { src, alt: '' }));
    layer.dataset.name = name;
    container.append(layer);
  }
}

export const applyProfileBg = () => apply();

export function startProfileBackground() {
  changeInterval(apply, 1000, 4000);
  subscribe((patch) => { if ('profileBg' in patch || 'wallpaper' in patch) apply(); });
}
