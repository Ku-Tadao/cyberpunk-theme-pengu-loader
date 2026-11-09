// Your bars in the match details "Graphs" tab, in the accent colour. Riot's d3
// chart paints every bar blue / red by team from code (inline fill, no CSS), so
// the recolor can't reach them: each bar's row keeps its player in d3's
// __data__, and the bars of the row with isLocalPlayer are repainted. With
// several stats picked, each player gets one bar per stat; those fade like
// Riot's own shades do. Follows the recolor setting.

import { settings, subscribe } from './store.js';
import { changeInterval } from './perf.js';

const BARS = '.match-main-graph rect.match-graph-stat-bar, .match-main-graph rect.match-graph-stat-bar-rect';
const SHADES = [1, 0.7, 0.45, 0.3];

function isMine(bar) {
  for (let el = bar.parentNode, i = 0; el && i < 3; el = el.parentNode, i++) {
    if (el.__data__?.isLocalPlayer) return true;
  }
  return false;
}

function apply() {
  for (const bar of document.querySelectorAll(BARS)) {
    if (!isMine(bar)) continue;
    if (!settings.recolor) {
      // put Riot's colour back
      if (bar.dataset.ccRiotFill !== undefined) {
        bar.style.fill = bar.dataset.ccRiotFill;
        delete bar.dataset.ccRiotFill;
      }
      continue;
    }
    if (bar.dataset.ccRiotFill === undefined) bar.dataset.ccRiotFill = bar.style.fill;
    const i = [...bar.parentNode.querySelectorAll('rect')].indexOf(bar);
    bar.style.setProperty('fill', `rgba(var(--cc-accent-rgb), ${SHADES[i] ?? 0.3})`, 'important');
  }
}

export function startGraphColor() {
  changeInterval(apply, 700, 3000);
  subscribe((patch) => { if ('recolor' in patch) apply(); });
}
