import { h } from './ui.js';
import { settings, subscribe } from './store.js';
import { wallpaperUrl, isVideo } from './assets.js';
import { startRecolor } from './recolor.js';

const BASE = new URL('../', import.meta.url).href;

function stylesheet(file) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL(`../${file}`, import.meta.url).href;
  document.head.appendChild(link);
  return link;
}

// Riot's UI gold sits around hue 40deg; rotating by (accent hue - 40) recolors
// their gold controls into the accent color.
const hueShift = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return { deg: 0, sat: 0.15 };
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  const sat = d / (1 - Math.abs(max + min - 1));
  // near-grey accents: wash the gold out instead of rotating it
  return { deg: Math.round(hue - 40), sat: sat < 0.25 ? 0.15 : 1.4 };
};

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

function renderWallpaper(layer, value) {
  if (!value) return layer.replaceChildren();
  const url = wallpaperUrl(value);
  layer.replaceChildren(isVideo(value)
    ? h('video', { class: 'cc-wp-media', muted: true, autoplay: true, loop: true, playsInline: true, src: url })
    : h('div', { class: 'cc-wp-media', style: `background-image: url("${url}")` }));
}

export function mountTheme() {
  stylesheet('fonts.css');
  // recolor overrides go before theme.css so the hand-made theme wins ties
  const recolor = document.createElement('style');
  recolor.id = 'cc-recolor';
  document.head.appendChild(recolor);
  stylesheet('theme.css');
  const globalFont = stylesheet('fonts-global.css');

  const layer = h('div', { class: 'cc-wallpaper' });
  document.body.prepend(layer);
  document.body.classList.add('cc-themed');

  let shown;
  const apply = () => {
    const s = document.documentElement.style;
    s.setProperty('--cc-accent', settings.accent);
    s.setProperty('--cc-accent-rgb', hexToRgb(settings.accent));
    s.setProperty('--cc-accent-2', settings.accent2);
    s.setProperty('--cc-accent-2-rgb', hexToRgb(settings.accent2));
    // The match found HUD needs a real alert colour. Some presets (Arasaka) have a near-white
    // secondary, which came out as a white tag and white bars: use the main colour then.
    const alert = hueShift(settings.accent2).sat < 0.25 ? settings.accent : settings.accent2;
    const [ar, ag, ab] = hexToRgb(alert).split(', ').map(Number);
    s.setProperty('--cc-alert', alert);
    s.setProperty('--cc-alert-rgb', hexToRgb(alert));
    // text on the alert colour: dark on bright colours, white on dark ones
    s.setProperty('--cc-alert-ink', (0.2126 * ar + 0.7152 * ag + 0.0722 * ab) / 255 > 0.45 ? '#050507' : '#fff');
    const shift = hueShift(settings.accent);
    s.setProperty('--cc-hue', `${shift.deg}deg`);
    s.setProperty('--cc-sat', shift.sat);
    s.setProperty('--cc-blur', `${settings.blur}px`);
    s.setProperty('--cc-dim', settings.dim);
    document.body.classList.toggle('cc-fx', settings.effects);
    document.body.classList.toggle('cc-lite', settings.lite);
    globalFont.disabled = !settings.globalFont;
    document.body.classList.toggle('cc-recolor', settings.recolor);
    // by URL: it changes when the file is replaced under the same name
    const url = settings.wallpaper ? wallpaperUrl(settings.wallpaper) : '';
    // the first folder check only adds the file's stamp to the url: same file, keep it
    // (re-rendering would download a big GIF a second time at startup)
    if (shown && !shown.includes('?') && url.startsWith(`${shown}?`)) shown = url;
    if (shown !== url) {
      shown = url;
      renderWallpaper(layer, settings.wallpaper);
      document.body.classList.toggle('cc-has-wallpaper', !!url);
    }
  };
  apply();
  subscribe(apply);

  // in game the wallpaper is hidden (theme.css) and a video wallpaper paused, so the client
  // doesn't spend GPU time the game could use
  new MutationObserver(() => {
    const inGame = document.body.dataset.ccPhase === 'InProgress';
    for (const v of layer.querySelectorAll('video')) {
      if (inGame) v.pause();
      else v.play().catch(() => {});
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-cc-phase'] });
  startRecolor(recolor, (sheet) => !!sheet.href?.startsWith(BASE));
}
