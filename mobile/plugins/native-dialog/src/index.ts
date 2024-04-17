import { registerPlugin } from '@capacitor/core';

import type { DialogPlugin } from './definitions';

const Dialog = registerPlugin<DialogPlugin>('Dialog', {
  web: () => import('./web').then(m => new m.DialogWeb()),
});

export * from './definitions';
export { Dialog };
