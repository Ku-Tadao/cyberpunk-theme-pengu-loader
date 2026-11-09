// Makes the client's own TFT match history rows (Profile > Match History > TFT)
// expandable: click a game to see every player's placement, comp and augments.
//
// Each row is an Ember component with classNames "tft-match-summary-component"
// holding `match` ({ json, metadata }) and the viewed player's `puuid`. We reopen
// Ember.Component so every rendered row gets a click handler.

import { h } from './ui.js';
import { tftStatic } from './api.js';
import { tftDetail } from './history.js';
import { openProfile } from './profile.js';

const ROW = 'tft-match-summary-component';

export function initNativeHistory(context) {
  context.rcp.postInit('rcp-fe-ember-libs', async (api) => {
    const Ember = await api.getEmber();
    Ember.Component.reopen({
      didInsertElement() {
        this._super(...arguments);
        if (this.classNames?.includes?.(ROW)) attach(this);
      },
    });
  });
}

function attach(component) {
  const row = component.element;
  if (!row || row.dataset.cc) return;
  row.dataset.cc = '1';
  row.classList.add('cc-expandable');
  row.title = 'Click to see all players';
  row.addEventListener('click', (e) => {
    // keep the client's own buttons (replay, etc.) and our detail panel working
    if (e.target.closest('button, a, lol-uikit-flat-button, [class*="replay"], .cc-native-detail')) return;
    toggle(component, row);
  });
}

async function toggle(component, row) {
  const open = row.querySelector(':scope > .cc-native-detail');
  if (open) {
    open.remove();
    row.classList.remove('cc-expanded');
    return;
  }
  const match = component.get('match');
  if (!match?.json) return;
  row.classList.add('cc-expanded');
  const panel = h('div', { class: 'cc-ui cc-native-detail' }, h('div', { class: 'cc-empty' }, 'Loading…'));
  row.append(panel);
  const data = await tftStatic();
  panel.replaceChildren(tftDetail(match.json, component.get('puuid'), data, { openProfile }));
}
