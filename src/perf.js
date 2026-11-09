// Keeping the client light:
//  - while an animation plays, the background checks that walk the whole client
//    (recolor, icon/border, title, profile background, diagnostics) pause, so they
//    can't steal frames mid-animation
//  - while the client can't be seen (minimized, behind the game) or a game is running,
//    they don't run at all
//  - the walking passes only run after Riot actually changed the page (changeInterval),
//    with a slow safety pass for changes made inside shadow roots

let busyUntil = 0;

export const busy = () => Date.now() < busyUntil;

export function markBusy(ms) {
  busyUntil = Math.max(busyUntil, Date.now() + ms);
}

// nobody is looking: minimized / hidden window, or a game in progress
export const asleep = () => document.hidden || document.body?.dataset.ccPhase === 'InProgress';

// setInterval that skips its tick while busy or asleep
export function idleInterval(fn, ms) {
  return setInterval(() => { if (!busy() && !asleep()) fn(); }, ms);
}

// count page changes (elements added / removed anywhere in the document); a counter
// bump is all the observer does, so it costs next to nothing
let changes = 0;
new MutationObserver(() => { changes++; }).observe(document.documentElement, { childList: true, subtree: true });

// idleInterval that only runs fn when the page changed since its last run, or at
// least every maxMs (Riot also fills things in inside shadow roots, which the
// observer can't see)
export function changeInterval(fn, ms, maxMs) {
  let seen = -1;
  let last = 0;
  return idleInterval(() => {
    const now = Date.now();
    if (changes === seen && now - last < maxMs) return;
    seen = changes;
    last = now;
    fn();
  }, ms);
}
