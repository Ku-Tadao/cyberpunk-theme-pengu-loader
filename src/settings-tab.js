// Adds a "CustomClient" group to the client's own Settings window
// (same technique as other Pengu themes: register a settings category,
// an Ember route + empty template, then fill the scrollable when it appears).

import { h } from './ui.js';
import { toast } from './store.js';
import { createWallpaperPage, createProfilePage, createThemePage } from './customize.js';
import { createSettings } from './settings.js';
import { createHistory } from './history.js';

const GROUP = {
  name: 'custom-client',
  titleKey: 'cc_title',
  titleName: 'CustomClient',
  capitalTitleKey: 'cc_title_capital',
  capitalTitleName: 'CUSTOMCLIENT',
};

const TABS = [
  { name: 'cc-wallpaper', titleKey: 'cc_tab_wallpaper', titleName: 'WALLPAPER', cls: 'cc-settings-wallpaper', id: 'CcWallpaper', create: createWallpaperPage },
  { name: 'cc-profile', titleKey: 'cc_tab_profile', titleName: 'PROFILE ICON & BACKGROUND', cls: 'cc-settings-profile', id: 'CcProfile', create: createProfilePage },
  { name: 'cc-theme', titleKey: 'cc_tab_theme', titleName: 'THEME & ANIMATIONS', cls: 'cc-settings-theme', id: 'CcTheme', create: createThemePage },
  { name: 'cc-files', titleKey: 'cc_tab_files', titleName: 'FILES & QUEUE', cls: 'cc-settings-files', id: 'CcFiles', create: createSettings },
  { name: 'cc-history', titleKey: 'cc_tab_history', titleName: 'MATCH HISTORY', cls: 'cc-settings-history', id: 'CcHistory', create: createHistory },
];

const TRANSLATIONS = {
  [GROUP.titleKey]: GROUP.titleName,
  [GROUP.capitalTitleKey]: GROUP.capitalTitleName,
  ...Object.fromEntries(TABS.map((t) => [t.titleKey, t.titleName])),
};

let ember;

export function initSettingsTab(context) {
  context.rcp.postInit('rcp-fe-lol-l10n', (api) => {
    const tra = api.tra();
    const proto = Object.getPrototypeOf(tra);
    const get = proto.get;
    proto.get = function (key) {
      return key in TRANSLATIONS ? TRANSLATIONS[key] : get.apply(this, arguments);
    };
  });

  context.rcp.postInit('rcp-fe-ember-libs', async (api) => {
    ember = await api.getEmber();

    const extend = ember.Router.extend;
    ember.Router.extend = function () {
      const router = extend.apply(this, arguments);
      router.map(function () {
        for (const t of TABS) this.route(t.name);
      });
      return router;
    };

    const factory = await api.getEmberApplicationFactory();
    const builderFn = factory.factoryDefinitionBuilder;
    factory.factoryDefinitionBuilder = function () {
      const builder = builderFn.apply(this, arguments);
      const build = builder.build;
      builder.build = function () {
        if (this.getName() === 'rcp-fe-lol-settings') {
          for (const t of TABS) {
            this.addTemplate(t.name, ember.HTMLBars.template({
              id: t.id,
              block: JSON.stringify({
                statements: [
                  ['open-element', 'lol-uikit-scrollable', []],
                  ['static-attr', 'class', t.cls],
                  ['flush-element'],
                  ['close-element'],
                ],
                locals: [], named: [], yields: [], blocks: [], hasPartials: false,
              }),
              meta: {},
            }));
          }
        }
        return build.apply(this, arguments);
      };
      return builder;
    };
  });

  context.rcp.postInit('rcp-fe-lol-settings', async (api) => {
    const em = ember || (await waitFor(() => ember));
    const group = {
      name: GROUP.name,
      titleKey: GROUP.titleKey,
      capitalTitleKey: GROUP.capitalTitleKey,
      categories: [],
    };
    for (const t of TABS) {
      group.categories.push({
        name: t.name,
        titleKey: t.titleKey,
        routeName: t.name,
        group,
        loginStatus: true,
        requireLogin: false,
        forceDisabled: false,
        computeds: em.Object.create({ disabled: false }),
        isEnabled: () => true,
      });
    }
    api._modalManager._registeredCategoryGroups.splice(1, 0, group);
    api._modalManager._refreshCategoryGroups();
  });
}

const waitFor = (fn) => new Promise((resolve) => {
  const id = setInterval(() => { const v = fn(); if (v) { clearInterval(id); resolve(v); } }, 100);
});

// Fill our empty tabs whenever the client renders them.
export function watchSettingsTabs() {
  const pages = {};
  let queued = false;

  const fill = () => {
    queued = false;
    for (const t of TABS) {
      const host = document.querySelector(`lol-uikit-scrollable.${t.cls}:not([data-cc])`);
      if (!host) continue;
      host.dataset.cc = '1';
      try {
        pages[t.name] ??= t.create();
        host.append(h('div', { class: 'cc-ui cc-embedded' }, pages[t.name].el));
        pages[t.name].show?.();
      } catch (e) {
        console.error('[CustomClient]', e);
        toast.err(`CustomClient: ${e.message}`);
      }
    }
  };

  new MutationObserver(() => {
    if (!queued) { queued = true; requestAnimationFrame(fill); }
  }).observe(document.body, { childList: true, subtree: true });
}
