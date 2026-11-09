// Local-only custom title under your name: on your own profile and at the top
// of the friends list. Styles are pure CSS (see theme.css "Custom titles").

import { h } from './ui.js';
import { settings, subscribe } from './store.js';
import { me, isMyProfile } from './me.js';
import { changeInterval } from './perf.js';

export const TITLE_STYLES = [
  ['glitch', 'Glitch'],
  ['neon', 'Neon'],
  ['tag', 'Hazard tag'],
  ['type', 'Typewriter'],
];

function place(host, after, text, style, before = null) {
  let el = host.querySelector('.cc-title');
  if (!text) {
    el?.remove();
    delete host.dataset.ccTitle;
    return;
  }
  if (!el) {
    el = h('div', { class: 'cc-title' });
    if (before) before.before(el);
    else if (after) after.after(el);
    else host.append(el);
  }
  if (el.dataset.text !== text || el.dataset.style !== style) {
    el.textContent = text;
    el.dataset.text = text;
    el.dataset.style = style;
    el.style.setProperty('--len', text.length);
    // restart the entrance animation
    el.classList.remove('cc-title-in');
    void el.offsetWidth;
    el.classList.add('cc-title-in');
  }
  host.dataset.ccTitle = '';
}

function apply() {
  const text = settings.customTitle.trim();
  const style = settings.titleStyle;
  for (const host of document.querySelectorAll('.style-profile-summoner-namings-component')) {
    if (!isMyProfile(host)) continue;
    // Riot's title lives above the 3 challenge tokens; ours takes exactly that spot
    const info = host.closest('.style-profile-summoner-info-component');
    const riotTitle = info?.querySelector('.challenge-banner-title-component');
    if (riotTitle && info) {
      host.querySelector(':scope > .cc-title')?.remove();
      place(riotTitle.parentElement, null, text, style, riotTitle);
      if (text) info.dataset.ccTitle = '';
      else delete info.dataset.ccTitle;
    } else {
      place(host, host.querySelector('.style-profile-summoner-name'), text, style);
    }
  }
  const identity = document.querySelector('.lol-social-identity');
  if (identity) place(identity, identity.querySelector('.name'), text, style);

  // your card in the lobby: Riot's title is hidden by CSS and ours takes its place
  if (!me.puuid) return;
  for (const regalia of document.querySelectorAll(`[puuid="${me.puuid}"]`)) {
    const banner = regalia.closest('.v2-banner-component, .lobby-banner');
    if (!banner) continue;
    const riotTitle = banner.querySelector('.challenge-banner-title-component');
    if (riotTitle) {
      banner.querySelector('.player-name-container + .cc-title')?.remove();
      place(riotTitle.parentElement, null, text, style, riotTitle);
      if (text) banner.dataset.ccTitle = '';
      else delete banner.dataset.ccTitle;
    } else {
      place(banner, banner.querySelector('.player-name-container'), text, style);
    }
  }
}

export const applyTitle = () => apply();

export function startTitle() {
  changeInterval(apply, 1000, 4000);
  subscribe((patch) => { if ('customTitle' in patch || 'titleStyle' in patch) apply(); });
}

// a live preview for the settings page
export function titlePreview() {
  const el = h('div', { class: 'cc-title cc-title-in' });
  const draw = () => {
    const text = settings.customTitle.trim() || 'Your title';
    el.textContent = text;
    el.dataset.text = text;
    el.dataset.style = settings.titleStyle;
    el.style.setProperty('--len', text.length);
    el.classList.remove('cc-title-in');
    void el.offsetWidth;
    el.classList.add('cc-title-in');
  };
  draw();
  subscribe((patch) => { if ('customTitle' in patch || 'titleStyle' in patch) draw(); });
  return el;
}
