import { registerPlugin } from '@capacitor/core';
const Dialog = registerPlugin('Dialog', {
    web: () => import('./web').then(m => new m.DialogWeb()),
});
export * from './definitions';
export { Dialog };
//# sourceMappingURL=index.js.map