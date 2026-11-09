// Tiny DOM helpers + line icons. Text goes through text nodes, never innerHTML.

import { settings, update } from './store.js';

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

const PATHS = {
  logo: '<path d="M12 2.5 20.5 7.25v9.5L12 21.5l-8.5-4.75v-9.5z"/><path d="M12 8v8M8.5 10l3.5-2 3.5 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.8"/><path d="m21 15-4-4L6 21"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  slash: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
};

export function icon(name, size = 18) {
  const span = document.createElement('span');
  span.className = 'cc-icon';
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
  return span;
}

export const pageHead = (kicker, title, ...extra) =>
  h('header', { class: 'cc-head' },
    h('div', { class: 'cc-head-title' },
      h('span', { class: 'cc-kicker' }, kicker),
      h('h2', { class: 'cc-glitch', 'data-text': title }, title)),
    ...extra);

export function section(title, desc, ...children) {
  return h('section', { class: 'cc-section' },
    h('h3', {}, title),
    desc && h('p', { class: 'cc-muted' }, desc),
    ...children);
}

export const field = (label, ...controls) =>
  h('div', { class: 'cc-field' }, h('span', { class: 'cc-label' }, label), ...controls);

export function toggle(on, onChange) {
  const btn = h('button', {
    class: 'cc-switch' + (on ? ' on' : ''),
    role: 'switch',
    onclick: () => {
      on = !on;
      btn.classList.toggle('on', on);
      onChange(on);
    },
  });
  return btn;
}

export const settingToggle = (label, key) => field(label, toggle(settings[key], (on) => update({ [key]: on })));

export function slider(label, key, min, max, step, fmt = (v) => v) {
  const out = h('span', { class: 'cc-value' }, fmt(settings[key]));
  const input = h('input', {
    type: 'range', min, max, step, value: settings[key],
    oninput: () => { update({ [key]: Number(input.value) }); out.textContent = fmt(input.value); },
  });
  return field(label, input, out);
}

export function segmented(options, value, onChange) {
  const seg = h('div', { class: 'cc-seg' });
  const draw = () => seg.replaceChildren(...options.map(([v, text]) =>
    h('button', { class: v === value ? 'active' : '', onclick: () => { value = v; draw(); onChange(v); } }, text)));
  draw();
  return seg;
}

export const empty = (text) => h('div', { class: 'cc-empty' }, text);

export function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const duration = (sec) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
