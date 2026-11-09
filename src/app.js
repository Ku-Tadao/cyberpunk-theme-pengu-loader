import { h, icon } from './ui.js';
import { toast } from './store.js';
import { createHistory } from './history.js';
import { createCustomize } from './customize.js';
import { createSettings } from './settings.js';

const SECTIONS = [
  { id: 'history', label: 'History', icon: 'history', create: createHistory },
  { id: 'customize', label: 'Customize', icon: 'image', create: createCustomize },
  { id: 'settings', label: 'Settings', icon: 'sliders', create: createSettings },
];

export function mountApp() {
  const views = {};
  const navItems = {};
  const content = h('div', { class: 'cc-content' });

  const overlay = h('div', { class: 'cc-ui cc-overlay', onmousedown: (e) => e.target === overlay && close() },
    h('div', { class: 'cc-modal' },
      h('nav', { class: 'cc-nav' },
        h('div', { class: 'cc-brand' }, icon('logo', 22), h('span', {}, 'Custom', h('b', {}, 'Client'))),
        ...SECTIONS.map((s) => (navItems[s.id] = h('button', { class: 'cc-nav-item', onclick: () => open(s.id) },
          icon(s.icon, 17), h('span', {}, s.label)))),
        h('div', { class: 'cc-nav-foot' }, h('kbd', {}, 'Esc'), ' to close')),
      content,
      h('button', { class: 'cc-btn-icon cc-close', title: 'Close', onclick: close }, icon('x'))));

  document.body.append(overlay);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  let closing = 0;

  function open(id) {
    clearTimeout(closing);
    overlay.classList.remove('closing');
    overlay.classList.add('open');
    for (const [k, btn] of Object.entries(navItems)) btn.classList.toggle('active', k === id);
    try {
      const s = SECTIONS.find((x) => x.id === id);
      views[id] ??= s.create();
      content.replaceChildren(views[id].el);
      views[id].show?.();
    } catch (e) {
      console.error('[CustomClient]', e);
      toast.err(`CustomClient: ${e.message}`);
    }
  }

  // plays the CRT power-off (theme.css "Motion v2") before hiding; instant without effects
  function close() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    if (!document.body.classList.contains('cc-fx')) return;
    overlay.classList.add('closing');
    clearTimeout(closing);
    closing = setTimeout(() => overlay.classList.remove('closing'), 240);
  }

  return { open, close };
}
