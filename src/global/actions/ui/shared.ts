import { addActionHandler } from '../../index';

addActionHandler('setTheme', (global, actions, { theme }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      theme,
    },
  };
});

addActionHandler('setAnimationLevel', (global, actions, { level }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      animationLevel: level,
    },
  };
});
