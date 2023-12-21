import { registerPlugin } from '@capacitor/core';

import type { BottomSheetPlugin } from './definitions';

const BottomSheet = registerPlugin<BottomSheetPlugin>('BottomSheet');

export * from './definitions';
export { BottomSheet };
