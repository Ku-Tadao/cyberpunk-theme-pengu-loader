import { h, icon, section, slider, settingToggle, pageHead } from './ui.js';
import { settings, subscribe, update, reset, toast } from './store.js';
import { FOLDERS, folderPath, openFolder } from './assets.js';
import { lcu, post } from './api.js';
import { resetDebugCapture } from './debug.js';
import { previewMatchFound, breach } from './cyberware.js';

const FOLDER_ICONS = { wallpapers: 'image', icons: 'user', profileBgs: 'image', banners: 'image', borders: 'user' };

function folderRow(folder) {
  const count = h('span', { class: 'cc-badge' });
  const refresh = () => { count.textContent = `${settings[folder].length} files`; };
  refresh();
  subscribe((patch) => { if (folder in patch) refresh(); });

  return h('div', { class: 'cc-folder' },
    h('div', { class: 'cc-folder-icon' }, icon(FOLDER_ICONS[folder], 20)),
    h('div', { class: 'cc-folder-info' },
      h('strong', {}, FOLDERS[folder].label),
      h('code', { class: 'cc-path' }, folderPath(folder))),
    count,
    h('button', { class: 'cc-btn primary', onclick: () => openFolder(folder) }, icon('folder', 14), 'Open folder'));
}

function inviteAll() {
  const groups = h('select', { class: 'cc-select', onchange: () => update({ inviteGroup: groups.value }) },
    h('option', { value: '' }, 'All groups'));
  lcu('/lol-chat/v1/friend-groups').then((list) => {
    for (const g of list || []) groups.append(h('option', { value: String(g.id), selected: String(g.id) === settings.inviteGroup }, g.name || 'General'));
  }).catch(() => {});

  const run = async () => {
    try {
      const friends = await lcu('/lol-chat/v1/friends');
      const targets = (friends || []).filter((f) => f.availability === 'chat' && (!settings.inviteGroup || String(f.groupId) === settings.inviteGroup));
      if (!targets.length) return toast.err('Nobody online in that group');
      await post('/lol-lobby/v2/lobby/invitations', targets.map((f) => ({ toSummonerId: f.summonerId })));
      toast.ok(`Invited ${targets.length} friend(s)`);
    } catch (e) {
      toast.err(`Couldn't invite: ${e.message}`);
    }
  };
  return h('div', { class: 'cc-field' }, h('span', { class: 'cc-label' }, 'Group'), groups,
    h('button', { class: 'cc-btn primary', onclick: run }, 'Invite all online'));
}

export function createSettings() {
  const el = h('div', { class: 'cc-page' },
    pageHead('System', 'Settings'),
    section('Custom files', null,
      h('ol', { class: 'cc-steps' },
        h('li', {}, 'Open folder'),
        h('li', {}, 'Drop your files in'),
        h('li', {}, 'Double-click "_Refresh list.cmd"'),
        h('li', {}, 'Pick them in Customize')),
      ...Object.keys(FOLDERS).map(folderRow)),
    section('Sound', 'Soft futuristic sounds instead of Riot\'s. Off brings back Riot\'s own sounds (a client restart swaps any already loaded).',
      settingToggle('Custom sounds', 'customSounds'),
      settingToggle('Robot voice', 'robotVoice'),
      h('button', { class: 'cc-btn', onclick: () => { document.querySelector('.cc-overlay.open') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); setTimeout(previewMatchFound, 300); } }, 'Preview match found'),
      ...[['enter', 'Preview create lobby'], ['leave', 'Preview leave lobby']].map(([mode, label]) => h('button', { class: 'cc-btn', onclick: () => { document.querySelector('.cc-overlay.open') && document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); setTimeout(() => breach(mode), 300); } }, label))),
    section('Party tools', 'From ElainaV4: invite everyone online in one of your friend groups.', inviteAll()),
    section('Diagnostics', 'Saves a small outline of your profile and lobby card screens so styling problems can be fixed precisely.',
      h('button', { class: 'cc-btn', onclick: () => { resetDebugCapture(); toast.ok('Open your profile and a lobby; the outline is saved automatically'); } }, 'Capture again')),
    section('Reset', null,
      h('button', {
        class: 'cc-btn',
        onclick: () => {
          reset(['wallpaper', 'customIcon', 'profileBg', 'dim', 'style', 'accent', 'accent2', 'blur', 'globalFont', 'effects']);
          toast.ok('Appearance reset');
        },
      }, 'Reset appearance')));

  return { el };
}
