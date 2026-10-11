import type { LangFn } from '../../../../../hooks/useLang';
import type { TabWithProperties } from '../../../../ui/TabList';

import { AccountTab, TAB_TITLES } from '../constants';

// Build tabs array based on environment
export function buildTabs(lang: LangFn): TabWithProperties<AccountTab>[] {
  return [
    { id: AccountTab.All, title: lang(TAB_TITLES[AccountTab.All]) },
    { id: AccountTab.My, title: lang(TAB_TITLES[AccountTab.My]) },
    { id: AccountTab.View, title: lang(TAB_TITLES[AccountTab.View]) },
  ];
}

// Get current tab index from tabs array
export function getCurrentTabIndex(tabs: TabWithProperties<AccountTab>[], activeTab: AccountTab): number {
  const idx = tabs.findIndex((tab) => tab.id === activeTab);
  return idx >= 0 ? idx : 0;
}
