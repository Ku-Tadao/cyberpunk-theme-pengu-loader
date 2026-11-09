// Friends list order: in game first, then online, then away / mobile, then offline.
// The social app's Ember "friends" service sorts with _getAvailabilitySort(availability)
// (Riot: online 1, in game 2, mobile 3, away 4, offline 5). The list is virtualised, so
// reordering rows in the DOM can't work: we swap the ranking on the service instance the
// first time one of the social app's components renders, then ask it to re-sort.
// Only applies while the client's own "sort by availability" chat setting is on.

const RANK = { dnd: 1, spectating: 1, chat: 2, online: 2, available: 2, away: 3, mobile: 4, offline: 5, '': 5 };

export function initFriendSort(context) {
  context.rcp.postInit('rcp-fe-ember-libs', async (api) => {
    const Ember = await api.getEmber();
    let done = false;
    Ember.Component.reopen({
      didInsertElement() {
        this._super(...arguments);
        if (done) return;
        try {
          const svc = Ember.getOwner(this)?.lookup('service:friends');
          if (!svc || typeof svc._friendSort !== 'function') return;
          svc._getAvailabilitySort = (a) => RANK[a] ?? 5;
          svc.notifyPropertyChange('sortedFriends');
          done = true;
        } catch {}
      },
    });
  });
}
