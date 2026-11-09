import { h, icon } from './ui.js';
import { settings, update, subscribe } from './store.js';
import { FOLDERS, fileUrl, isVideo, isAnimated, openFolder, folderPath, watch } from './assets.js';

// Grid of files from an asset folder; clicking one selects it.
export function createGallery(folder, { shape = 'wide', noneLabel = 'None' } = {}) {
  const key = FOLDERS[folder].key;
  const grid = h('div', { class: `cc-gallery ${shape}` });
  const status = h('span', { class: 'cc-status' });

  const tile = (value, title, content) => h('button', {
    class: 'cc-tile' + (settings[key] === value ? ' active' : ''),
    title,
    onclick: () => update({ [key]: value }),
  }, h('div', { class: 'cc-tile-inner' }, content));

  const media = (name) => isVideo(name)
    ? h('video', {
      muted: true, loop: true, preload: 'metadata', src: `${fileUrl(folder, name)}#t=0.5`,
      onmouseenter: (e) => e.target.play(), onmouseleave: (e) => e.target.pause(),
    })
    : h('img', { src: fileUrl(folder, name), loading: 'lazy', alt: '' });

  const draw = () => grid.replaceChildren(
    tile('', noneLabel, h('div', { class: 'cc-tile-label' }, icon('slash', 16), noneLabel)),
    ...settings[folder].map((name) => tile(name, name, [
      media(name),
      isAnimated(name) && h('span', { class: 'cc-tile-tag' }, 'Live'),
    ])),
    h('button', { class: 'cc-tile add', title: 'Open folder', onclick: () => openFolder(folder) },
      h('div', { class: 'cc-tile-inner' }, h('div', { class: 'cc-tile-label' }, icon('plus', 16), 'Add'))));

  draw();
  subscribe((patch) => { if (folder in patch || key in patch) draw(); });

  const el = h('div', { class: 'cc-gallery-wrap' },
    h('div', { class: 'cc-toolbar' },
      status,
      h('code', { class: 'cc-path' }, folderPath(folder)),
      h('button', { class: 'cc-btn', onclick: () => openFolder(folder) }, icon('folder', 14), 'Open folder')),
    grid);

  watch(folder, el, (ok) => {
    status.className = 'cc-status' + (ok ? ' live' : ' off');
    status.title = ok ? 'Watching folder' : 'No index yet: double-click "_Refresh list.cmd" in the folder';
  });
  return el;
}
