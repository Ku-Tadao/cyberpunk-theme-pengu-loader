// Opens a player's profile in the client's own profile overlay (rcp-fe-lol-profiles).

let profiles = null;

export function initProfiles(context) {
  context.rcp.postInit('rcp-fe-lol-profiles', (api) => { profiles = api; });
}

export function openProfile({ puuid }) {
  if (!profiles) return;
  // our own window sits above everything, so get it out of the way
  document.querySelector('.cc-overlay.open')?.classList.remove('open');
  profiles.showOverlay({ puuid, showMatchHistory: true });
}
