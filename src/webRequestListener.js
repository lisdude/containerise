import Storage from './Storage/index';
import ContextualIdentity from './ContextualIdentity';
import Tabs, {NEW_TAB_PAGES} from './Tabs';

const createTab = (url, newTabIndex, currentTabId, cookieStoreId, closeTab, openerTabId) => {
  Tabs.create({
    url,
    index: newTabIndex,
    cookieStoreId,
    openerTabId,
  });

  if (closeTab) {
    Tabs.remove(currentTabId);
  }

  return {
    cancel: true,
  };
};

export const webRequestListener = (requestDetails) => {

  if (requestDetails.frameId !== 0 || requestDetails.tabId === -1) {
    return {};
  }

  const url = new window.URL(requestDetails.url);
  const hostname = url.hostname.replace('www.', '');

  return Promise.all([
    Storage.get(hostname),
    ContextualIdentity.getAll(),
    Tabs.get(requestDetails.tabId),
    Storage.get('default'),
  ]).then(([hostMap, identities, currentTab, defaultContainer]) => {

    if (currentTab.incognito || !hostMap) {
      return {};
    }

    const hostIdentity = identities.find((identity) => identity.cookieStoreId === hostMap.cookieStoreId);
    const defaultIdentity = identities.find((identity) => identity.cookieStoreId === defaultContainer.cookieStoreId);
    const closeTab = NEW_TAB_PAGES.has(currentTab.url);
    // WARNING: When you open a new tab with cookieStoreId firefox-default, it won't work with an openerTabId set. The cookiestore will default to the opener tab.
    //              However, it works just fine when you use firefox-default with no openerTabId OR if you use any other cookieStoreId with an openerTabId.
    const previousTab = closeTab ? currentTab.openerTabId : currentTab.id;

    let newContainer;

    if (!hostIdentity && defaultIdentity && currentTab.cookieStoreId !== defaultContainer.cookieStoreId) {
      newContainer = defaultContainer.cookieStoreId;
    } else if (hostIdentity && hostIdentity.cookieStoreId !== currentTab.cookieStoreId) {
      newContainer = hostIdentity.cookieStoreId;
    }

    return !newContainer ? {} : createTab(requestDetails.url, currentTab.index + 1, currentTab.id, newContainer, closeTab, previousTab);
  });

};
