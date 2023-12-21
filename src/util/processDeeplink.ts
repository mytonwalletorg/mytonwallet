import { BottomSheet } from 'native-bottom-sheet';
import { getActions } from '../global';

import { TON_TOKEN_SLUG } from '../config';
import { bigStrToHuman } from '../global/helpers';
import { parseTonDeeplink } from './ton/deeplinks';
import { pause } from './schedulers';
import { IS_DELEGATING_BOTTOM_SHEET } from './windowEnvironment';

// Both to close current Transfer Modal and delay when app launch
const PAUSE = 700;
export async function processDeeplink(url: string) {
  const params = parseTonDeeplink(url);
  if (!params) return false;

  if (IS_DELEGATING_BOTTOM_SHEET) {
    await BottomSheet.release({ key: '*' });
    await pause(PAUSE);
  }

  getActions().startTransfer({
    isPortrait: true,
    tokenSlug: TON_TOKEN_SLUG,
    toAddress: params.to,
    amount: params.amount ? bigStrToHuman(params.amount) : undefined,
    comment: params.comment,
  });

  return true;
}
