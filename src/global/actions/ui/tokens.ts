import { ContentTab } from '../../types';

import { areSortedArraysEqual, unique } from '../../../util/iteratees';
import { addActionHandler } from '../../index';
import { updateCurrentAccountSettings } from '../../reducers';
import { selectCurrentAccountSettings, selectCurrentAccountTokens } from '../../selectors';

addActionHandler('rebuildOrderedSlugs', (global) => {
  const accountSettings = selectCurrentAccountSettings(global) ?? {};
  const { orderedSlugs = [] } = accountSettings;
  const accountTokens = selectCurrentAccountTokens(global) ?? [];
  const allSlugs = accountTokens.map(({ slug }) => slug);
  const newOrderedSlugs = unique([...orderedSlugs, ...allSlugs]);

  if (areSortedArraysEqual(orderedSlugs, newOrderedSlugs)) {
    return global;
  }

  return updateCurrentAccountSettings(global, {
    ...accountSettings,
    orderedSlugs: newOrderedSlugs,
  });
});

addActionHandler('showTokenActivity', (global, actions, { slug }) => {
  actions.selectToken({ slug }, { forceOnHeavyAnimation: true });
  actions.setActiveContentTab({ tab: ContentTab.Activity });
});
