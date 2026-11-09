// Re-colours Riot's own styles at runtime: every stylesheet the client loads
// (in the page and inside each shadow root) is read through the CSSOM, and any
// declaration using Riot's gold / cream / navy / teal palette gets an override
// in the theme colours. Overrides only ever sit next to the sheet they came
// from, so a component's rules never leak onto other parts of the client.

import { settings, subscribe } from './store.js';
import { changeInterval } from './perf.js';

// [r, g, b] -> [theme rgb variable, alpha factor]
const PALETTE = [
  [[240, 230, 210], '--cc-text-rgb', 1],
  [[205, 250, 250], '--cc-text-rgb', 1],
  [[205, 190, 145], '--cc-accent-rgb', 0.85],
  [[200, 170, 110], '--cc-accent-rgb', 1],
  [[200, 155, 60], '--cc-accent-rgb', 1],
  [[201, 162, 60], '--cc-accent-rgb', 1],
  [[208, 154, 29], '--cc-accent-rgb', 1],
  [[250, 190, 10], '--cc-accent-rgb', 1],   // "you" on the end-of-game recap (damage bar, name)
  [[120, 90, 40], '--cc-accent-rgb', 0.45],
  [[105, 86, 37], '--cc-accent-rgb', 0.45],
  [[70, 55, 20], '--cc-accent-rgb', 0.22],
  [[50, 40, 30], '--cc-accent-rgb', 0.12],
  [[160, 155, 140], '--cc-muted-rgb', 1],
  [[1, 10, 19], '--cc-bg-rgb', 1],
  [[1, 10, 20], '--cc-bg-rgb', 1],
  [[0, 10, 20], '--cc-bg-rgb', 1],
  [[7, 16, 25], '--cc-bg-rgb', 1],
  [[10, 20, 40], '--cc-bg-rgb', 1],
  [[9, 20, 40], '--cc-bg-rgb', 1],
  [[10, 200, 185], '--cc-accent-3-rgb', 1],
  [[5, 150, 170], '--cc-accent-3-rgb', 1],
  [[3, 151, 171], '--cc-accent-3-rgb', 1],
  [[22, 202, 229], '--cc-accent-3-rgb', 1],
  [[10, 150, 170], '--cc-accent-3-rgb', 1],
  [[0, 90, 130], '--cc-accent-3-rgb', 0.35],
  [[10, 50, 60], '--cc-accent-3-rgb', 0.18],
  [[190, 30, 55], '--cc-accent-2-rgb', 1],
];
const PROPS = /color$|^background-image$|^border-image-source$|shadow$|^fill$|^stroke$/;
const COLOR = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g;

function mapColor(r, g, b, a) {
  for (const [[R, G, B], v, k] of PALETTE) {
    if (Math.abs(r - R) <= 3 && Math.abs(g - G) <= 3 && Math.abs(b - B) <= 3) {
      return `rgba(var(${v}), ${+(a * k).toFixed(3)})`;
    }
  }
  return null;
}

function recolorValue(value) {
  let hit = false;
  const out = value.replace(COLOR, (m, r, g, b, a) => {
    const n = mapColor(+r, +g, +b, a === undefined ? 1 : +a);
    if (!n) return m;
    hit = true;
    return n;
  });
  return hit ? out : null;
}

export const px = (v) => (v && v.endsWith('px') ? parseFloat(v) : Infinity);

export function rulesToCss(rules) {
  let css = '';
  for (const rule of rules) {
    if (rule.type === CSSRule.STYLE_RULE) {
      const style = rule.style;
      // :host rules stay non-important so page-level overrides still win
      const imp = rule.selectorText.includes(':host') ? '' : ' !important';
      // small boxes are icon plates: Riot's navy behind them would turn into
      // black squares on the see-through theme, so those become transparent
      const small = px(style.getPropertyValue('width')) <= 64 && px(style.getPropertyValue('height')) <= 64;
      let decl = '';
      for (let i = 0; i < style.length; i++) {
        const prop = style[i];
        if (!PROPS.test(prop)) continue;
        const value = style.getPropertyValue(prop);
        if (!value || value.includes('url(')) continue;
        const n = small && prop === 'background-color' && value.replace(COLOR, (m, r, g, b) => (mapColor(+r, +g, +b, 1)?.includes('--cc-bg-rgb') ? '§' : m)) === '§'
          ? 'transparent'
          : recolorValue(value);
        if (n) decl += `${prop}: ${n}${imp}; `;
      }
      if (decl) css += `${rule.selectorText} { ${decl}}\n`;
    } else if (rule.type === CSSRule.MEDIA_RULE) {
      const inner = rulesToCss(rule.cssRules);
      if (inner) css += `@media ${rule.conditionText} {\n${inner}}\n`;
    }
  }
  return css;
}

const readRules = (sheet) => {
  try { return sheet.cssRules; } catch { return null; }
};

const ours = new Set();            // every sheet we created
const overrides = new Set();       // recolor sheets, toggled by the setting
const byText = new Map();          // shadow <style> text -> override sheet
const bySheet = new WeakMap();     // source sheet -> override sheet (or null)
const rootSig = new WeakMap();     // shadow root -> signature of its sheets
const docDone = new WeakSet();
const handSheet = new CSSStyleSheet();
ours.add(handSheet);

function overrideFor(src) {
  if (bySheet.has(src)) return bySheet.get(src);
  const rules = readRules(src);
  if (!rules) return null;
  const text = src.ownerNode?.textContent;
  if (text && byText.has(text)) {
    bySheet.set(src, byText.get(text));
    return byText.get(text);
  }
  const css = rulesToCss(rules);
  let sheet = null;
  if (css) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    sheet.disabled = !settings.recolor;
    ours.add(sheet);
    overrides.add(sheet);
  }
  bySheet.set(src, sheet);
  if (text) byText.set(text, sheet);
  return sheet;
}

function processRoot(sr) {
  const sources = [...sr.styleSheets, ...sr.adoptedStyleSheets.filter((s) => !ours.has(s))];
  // re-process when a sheet is added or finishes loading
  const sig = sources.map((s) => readRules(s)?.length ?? -1).join(',');
  if (rootSig.get(sr) === sig) return;
  rootSig.set(sr, sig);
  const extra = sources.map(overrideFor).filter(Boolean);
  sr.adoptedStyleSheets = [...sr.adoptedStyleSheets.filter((s) => !ours.has(s)), ...extra, handSheet];
}

function walk(root) {
  for (const el of root.querySelectorAll('*')) {
    if (!el.shadowRoot) continue;
    processRoot(el.shadowRoot);
    walk(el.shadowRoot);
  }
}

// one immediate pass (page gate); set once startRecolor has run
export let recolorNow = () => {};

export async function startRecolor(docStyle, isOwnSheet) {
  try {
    const res = await fetch(new URL('../shadow.css', import.meta.url));
    if (res.ok) handSheet.replaceSync(await res.text());
  } catch {}

  const scanDocument = () => {
    let added = '';
    for (const sheet of document.styleSheets) {
      if (docDone.has(sheet) || sheet.ownerNode === docStyle || isOwnSheet(sheet)) continue;
      const rules = readRules(sheet);
      if (!rules || (!rules.length && sheet.href)) continue; // not loaded yet
      docDone.add(sheet);
      added += rulesToCss(rules);
    }
    if (added) docStyle.append(added);
  };

  const apply = () => {
    docStyle.disabled = !settings.recolor;
    for (const s of overrides) s.disabled = !settings.recolor;
  };
  apply();
  subscribe((patch) => { if ('recolor' in patch) apply(); });

  const tick = () => { scanDocument(); walk(document); };
  recolorNow = tick;
  tick();
  changeInterval(tick, 1500, 6000);
}
