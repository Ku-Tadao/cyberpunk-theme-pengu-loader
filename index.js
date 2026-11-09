/**
 * @name CustomClient
 * @author othkourbi
 * @description Cyberpunk reskin, custom wallpapers/pictures/banners, TFT match history and QoL features
 */

import { playSound } from './src/sounds.js';
import { settings, update, subscribe } from './src/store.js';
import { mountTheme } from './src/theme.js';
import { mountApp } from './src/app.js';
import { startAssetSync } from './src/assets.js';
import { initIconOverride, startIconOverride, scanNow } from './src/icon-override.js';
import { startHoverCard } from './src/hovercard.js';
import { initTools, startTools } from './src/tools.js';
import { startStatusMenu } from './src/status-menu.js';
import { initSettingsTab, watchSettingsTabs } from './src/settings-tab.js';
import { initNativeHistory } from './src/native-history.js';
import { initFriendSort } from './src/friend-sort.js';
import { initProfiles } from './src/profile.js';
import { startProfileBackground } from './src/profile-bg.js';
import { startTitle } from './src/title.js';
import { startHomeToggle } from './src/home-toggle.js';
import { initPresence, startPresence } from './src/presence.js';
import { startDebugCapture, saveDebug } from './src/debug.js';
import { startTopBar } from './src/topbar.js';
import { startPageGate, gateLobby } from './src/page-gate.js';
import { startPreload } from './src/preload.js';
import { initCyberware, playCyberware } from './src/cyberware.js';
import { playMemberJoined, noteMemberLeft, rememberCards } from './src/joinfx.js';
import { initChat } from './src/chat.js';
import { initInvites } from './src/invites.js';
import { startGraphColor } from './src/graph-color.js';

// ---------- command bar (Ctrl+K) ----------

function registerCommands(app) {
  const add = (name, perform) => window.CommandBar?.addAction({ name, group: 'CustomClient', perform });
  add('Match history', () => app.open('history'));
  add('Customize', () => app.open('customize'));
  add('Settings', () => app.open('settings'));
  add('Hide / show friends list', () => update({ friendsHidden: !settings.friendsHidden }));
  add('Hide / show the page (home screens)', () => update({ homeHidden: !settings.homeHidden }));
  add('Preview lobby effect', playCyberware);
  add('Preview join effect', () => playMemberJoined({ gameName: 'Johnny', gameTag: '2077' }));
  add('Preview invite sound', () => playSound('invite'));
  add('Preview leave sound', () => playSound('node-leave'));
  add('Preview notification', () => window.Toast?.success?.('Incoming message // CustomClient'));
  add('Reload client UI', () => location.reload());
}

// ---------- Pengu entry points ----------

export function init(context) {
  initIconOverride(context.socket);
  initSettingsTab(context);
  initProfiles(context);
  initNativeHistory(context);
  initFriendSort(context);
  initPresence(context);
  initCyberware(context, playMemberJoined, noteMemberLeft, rememberCards, gateLobby);
  initTools(context);
  initChat(context);
  initInvites(context);
}

export function load() {
  mountTheme();
  registerCommands(mountApp());
  watchSettingsTabs();
  startIconOverride();
  startHoverCard(scanNow);
  startTools();
  startStatusMenu();
  startProfileBackground();
  startTitle();
  startHomeToggle(subscribe);
  startPresence();
  startDebugCapture();
  startTopBar((bar) => saveDebug('topBar', bar));
  startPageGate();
  startGraphColor();
  // preload after the first folder check: urls get their stamps then (no double download)
  startAssetSync().finally(startPreload);
}
