// Top bar = lol-uikit-navigation-bar.main-nav-bar (.left-nav-menu text tabs,
// .right-nav-menu icon tabs). Styling lives in theme.css / shadow.css; this
// lines the Play button up with the bar so the two read as one strip, and
// saves the bar's markup for diagnostics.

const BAR = 'lol-uikit-navigation-bar.main-nav-bar';

function align(bar) {
  const nav = document.querySelector('.navbar_backdrop');
  if (!nav) return;
  const n = nav.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  if (!b.width) return;
  const s = document.documentElement.style;
  s.setProperty('--cc-bar-top', `${Math.max(0, b.top - n.top)}px`);
  s.setProperty('--cc-bar-h', `${Math.max(32, b.height)}px`);
  // Play runs from the window's left edge up to the bar, leaving a 2px seam
  s.setProperty('--cc-play-w', `${Math.max(120, b.left - n.left - 2)}px`);
}

export function startTopBar(onFound) {
  const seen = new WeakSet();
  setInterval(() => {
    const bar = document.querySelector(BAR);
    if (!bar || !bar.getClientRects().length) return;
    align(bar);
    if (!seen.has(bar)) {
      seen.add(bar);
      onFound?.(bar);
    }
  }, 1500);
}
