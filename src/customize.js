import { h, section, field, slider, settingToggle, segmented, empty, pageHead } from './ui.js';
import { lcu, put, currentSummoner, profileIcon } from './api.js';
import { settings, update, toast } from './store.js';
import { createGallery } from './gallery.js';
import { TITLE_STYLES, titlePreview } from './title.js';
import { QUEUES, TIERS, DIVISIONS, STATUSES } from './presence.js';

// [id, name, primary, secondary]
const PRESETS = [
  ['cyberpunk', 'Cyberpunk', '#fcee0a', '#ff003c'],
  ['netrunner', 'Netrunner', '#00f0ff', '#ff2bd6'],
  ['arasaka', 'Arasaka', '#ff003c', '#e8e8e8'],
  ['militech', 'Militech', '#b6ff3d', '#fcee0a'],
  ['kiroshi', 'Kiroshi', '#a78bfa', '#00f0ff'],
];
const REFRESH_HINT = 'Drop files in the folder, double-click "_Refresh list.cmd" there, and they appear here.';

// A page whose sections are built the first time it is shown.
function lazyPage(kicker, title, builders) {
  const el = h('div', { class: 'cc-page' });
  let built = false;
  const show = () => {
    if (built) return;
    built = true;
    el.append(pageHead(kicker, title), ...builders.map((b) => b()));
  };
  return { el, show };
}

export const createCustomize = () =>
  lazyPage('Personalize', 'Customize', [wallpaperSection, identitySection, pictureSection, bannerSection, profileBgSection, rankSection, borderSection, appearanceSection]);
export const createWallpaperPage = () => lazyPage('Personalize', 'Wallpaper', [wallpaperSection]);
export const createProfilePage = () => lazyPage('Personalize', 'Profile', [identitySection, pictureSection, bannerSection, profileBgSection, rankSection, borderSection]);
export const createThemePage = () => lazyPage('Personalize', 'Theme', [appearanceSection]);

function wallpaperSection() {
  return section('Client wallpaper',
    `Static or animated: .jpg .png .gif .webp .mp4 .webm. ${REFRESH_HINT}`,
    createGallery('wallpapers'),
    slider('Dim', 'dim', 0, 0.85, 0.05, (v) => `${Math.round(v * 100)}%`));
}

const BORDERS = [
  ['', 'None'],
  ['neon', 'Neon'],
  ['dual', 'Dual ring'],
  ['pulse', 'Pulse'],
  ['glitch', 'Glitch'],
  ['scan', 'Scanner'],
  ['hazard', 'Hazard'],
];

function identitySection() {
  const input = h('input', {
    class: 'cc-input', type: 'text', maxLength: 32, placeholder: 'Type your title…', value: settings.customTitle,
    oninput: () => update({ customTitle: input.value }),
  });

  const borders = h('div', { class: 'cc-border-picker' });
  const drawBorders = () => borders.replaceChildren(...BORDERS.map(([id, name]) => h('button', {
    class: 'cc-border-option' + (settings.iconBorder === id ? ' active' : ''),
    onclick: () => { update({ iconBorder: id }); drawBorders(); },
  }, h('span', { class: 'cc-border-demo' }, id && h('span', { class: 'cc-ring', 'data-style': id })), name)));
  drawBorders();

  return section('Title & icon border',
    'Only you see these: your title shows under your name on your profile and in the friends list; the border goes around your icon everywhere.',
    field('Title', input),
    field('Title style', segmented(TITLE_STYLES, settings.titleStyle, (v) => update({ titleStyle: v }))),
    h('div', { class: 'cc-title-preview' }, titlePreview()),
    field('Icon border', borders),
    h('p', { class: 'cc-muted cc-note' }, 'Or pick an image frame (cyberpunk frames are included; add your own PNGs with a transparent middle):'),
    createGallery('borders', { shape: 'hex', noneLabel: 'Off' }));
}

function pictureSection() {
  const body = h('div', {});
  const custom = createGallery('icons', { shape: 'hex', noneLabel: 'Off' });
  let riot = null;
  const show = (tab) => body.replaceChildren(tab === 'custom' ? custom : (riot ??= riotIcons()));
  show('custom');

  return section('Profile picture', null,
    field('Source', segmented([['custom', 'Custom'], ['riot', 'Riot icons']], 'custom', show)),
    h('p', { class: 'cc-muted cc-note' },
      'Custom: .png .jpg, or animated .gif / animated .webp. Only you see a custom picture; Riot icons change what everyone sees.'),
    body);
}

function profileBgSection() {
  return section('Profile background',
    `Replaces the splash behind your own profile. Static or animated (.mp4 .webm .gif). Only you see it. ${REFRESH_HINT}`,
    createGallery('profileBgs', { noneLabel: 'Default' }));
}

function bannerSection() {
  return section('Banner',
    `Replaces the banner behind your crest on your profile and lobby card. Tall images work best (about 1:3). Only you see it. ${REFRESH_HINT}`,
    createGallery('banners', { noneLabel: 'Default' }));
}

const select = (options, value, onChange) => {
  const el = h('select', { class: 'cc-select', onchange: () => onChange(el.value) },
    ...options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
  return el;
};
const numberInput = (key, placeholder) => {
  const el = h('input', {
    class: 'cc-input', type: 'number', min: 0, placeholder, value: settings[key],
    onchange: () => update({ [key]: el.value.trim() }),
  });
  return el;
};

function rankSection() {
  const title = (t) => t.charAt(0) + t.slice(1).toLowerCase();
  return section('Status & rank',
    'Shown to your friends in your hover card (chat presence, like ElainaV4) and on your own profile emblem. Your real rank does not change; Riot resets presence when you log out, CustomClient re-applies it.',
    field('Status', segmented(STATUSES, settings.status, (v) => update({ status: v }))),
    field('Status message', (() => { const el = h('input', { class: 'cc-input', type: 'text', maxLength: 80, placeholder: 'Off (Riot default)', value: settings.statusMessage, onchange: () => update({ statusMessage: el.value.trim() }) }); return el; })()),
    field('Queue', segmented(QUEUES, settings.rankQueue, (v) => update({ rankQueue: v }))),
    field('Tier', select([['', 'Off (real rank)'], ...TIERS.map((t) => [t, title(t)])], settings.rankTier, (v) => update({ rankTier: v }))),
    field('Division', segmented(DIVISIONS.map((d) => [d, d]), settings.rankDivision, (v) => update({ rankDivision: v }))),
    field('Mastery score', numberInput('masteryScore', 'Off')),
    field('Challenge crystal', select([['', 'Off'], ...TIERS.map((t) => [t, title(t)])], settings.crystalTier, (v) => update({ crystalTier: v }))),
    field('Challenge points', numberInput('challengePoints', 'Off')));
}

function riotIcons() {
  const grid = h('div', { class: 'cc-gallery hex scroll' }, empty('Loading icons…'));
  Promise.all([currentSummoner(), lcu('/lol-inventory/v2/inventory/SUMMONER_ICON')])
    .then(([me, inventory]) => {
      const ids = [...new Set((inventory || []).map((i) => i.itemId))].sort((a, b) => b - a);
      grid.replaceChildren(...ids.map((id) => {
        const tile = h('button', {
          class: 'cc-tile' + (id === me.profileIconId ? ' active' : ''),
          title: `Icon ${id}`,
          onclick: async () => {
            try {
              await put('/lol-summoner/v1/current-summoner/icon', { profileIconId: id });
              grid.querySelector('.active')?.classList.remove('active');
              tile.classList.add('active');
              toast.ok('Profile icon updated');
            } catch (e) { toast.err(e.message); }
          },
        }, h('div', { class: 'cc-tile-inner' }, h('img', { src: profileIcon(id), loading: 'lazy', alt: '' })));
        return tile;
      }));
    })
    .catch((e) => grid.replaceChildren(empty(`Couldn't load icons: ${e.message}`)));
  return grid;
}

function borderSection() {
  const body = h('div', { class: 'cc-stack' }, empty('Loading…'));
  lcu('/lol-regalia/v2/current-summoner/regalia').then((reg) => {
    const choice = (label, key, options) => field(label, segmented(options, reg[key], async (value) => {
      const prev = reg[key];
      reg[key] = value;
      try { await put('/lol-regalia/v2/current-summoner/regalia', reg); } catch (e) { reg[key] = prev; toast.err(e.message); }
    }));
    body.replaceChildren(
      choice('Icon border', 'preferredCrestType', [['prestige', 'Level'], ['ranked', 'Ranked']]),
      choice('Banner', 'preferredBannerType', [['blank', 'Hidden'], ['lastSeasonHighestRank', 'Ranked']]));
  }).catch((e) => body.replaceChildren(empty(`Couldn't load border settings: ${e.message}`)));

  return section('Border & banner', null, body);
}

function appearanceSection() {
  const presets = h('div', { class: 'cc-presets' });
  const primary = h('input', { type: 'color', value: settings.accent, title: 'Primary color', oninput: () => setColors({ accent: primary.value }) });
  const secondary = h('input', { type: 'color', value: settings.accent2, title: 'Secondary color', oninput: () => setColors({ accent2: secondary.value }) });
  const draw = () => presets.replaceChildren(...PRESETS.map(([id, name, a, b]) => h('button', {
    class: 'cc-preset' + (settings.style === id ? ' active' : ''),
    style: `--a: ${a}; --b: ${b}`,
    onclick: () => { update({ style: id, accent: a, accent2: b }); primary.value = a; secondary.value = b; draw(); },
  }, h('span', { class: 'cc-preset-swatch' }), name)));
  const setColors = (patch) => { update({ style: 'custom', ...patch }); draw(); };
  draw();

  return section('Appearance', null,
    presets,
    field('Custom colors', h('div', { class: 'cc-swatches' }, primary, secondary)),
    slider('Glass blur', 'blur', 0, 30, 1, (v) => `${v}px`),
    settingToggle('Theme every Riot screen (store, loot, chat...)', 'recolor'),
    settingToggle('Futuristic font everywhere', 'globalFont'),
    settingToggle('Animations, scanlines & glow', 'effects'),
    settingToggle('Custom sounds', 'customSounds'),
    settingToggle('Loading screen between pages (no flash of the original look)', 'pageGate'),
    settingToggle('Lightweight mode (no glass blur or moving lines, for weaker PCs)', 'lite'));
}
