import { ActiveTab, TransferState } from '../../types';

import { fromDecimal, toDecimal } from '../../../util/decimals';
import { callActionInMain } from '../../../util/multitab';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateCurrentTransfer } from '../../reducers';
import { selectAccount } from '../../selectors';

addActionHandler('startTransfer', (global, actions, payload) => {
  const isOpen = global.currentTransfer.state !== TransferState.None;
  if (IS_DELEGATED_BOTTOM_SHEET && !isOpen) {
    callActionInMain('startTransfer', payload);
    return;
  }

  const { isPortrait, ...rest } = payload ?? {};

  const nftTokenSlug = Symbol('nft');
  const previousFeeTokenSlug = global.currentTransfer.nfts?.length ? nftTokenSlug : global.currentTransfer.tokenSlug;
  const nextFeeTokenSlug = payload?.nfts?.length ? nftTokenSlug : payload?.tokenSlug;
  const shouldClearFee = nextFeeTokenSlug && nextFeeTokenSlug !== previousFeeTokenSlug;

  setGlobal(updateCurrentTransfer(global, {
    state: isPortrait ? TransferState.Initial : TransferState.None,
    error: undefined,
    ...(shouldClearFee ? { fee: undefined, realFee: undefined, diesel: undefined } : {}),
    ...rest,
  }));

  if (!isPortrait) {
    actions.setLandscapeActionsActiveTabIndex({ index: ActiveTab.Transfer });
  }
});

addActionHandler('changeTransferToken', (global, actions, { tokenSlug, withResetAmount }) => {
  const { amount, tokenSlug: currentTokenSlug, nfts } = global.currentTransfer;
  if (!nfts?.length && tokenSlug === currentTokenSlug && !withResetAmount) {
    return;
  }

  const currentToken = currentTokenSlug ? global.tokenInfo.bySlug[currentTokenSlug] : undefined;
  const newToken = global.tokenInfo.bySlug[tokenSlug];

  if (withResetAmount) {
    global = updateCurrentTransfer(global, { amount: undefined });
  } else if (amount && currentToken?.decimals !== newToken?.decimals) {
    global = updateCurrentTransfer(global, {
      amount: fromDecimal(toDecimal(amount, currentToken?.decimals), newToken?.decimals),
    });
  }

  setGlobal(updateCurrentTransfer(global, {
    tokenSlug,
    fee: undefined,
    realFee: undefined,
    diesel: undefined,
    nfts: undefined,
  }));
});

addActionHandler('setTransferScreen', (global, actions, payload) => {
  const { state } = payload;

  setGlobal(updateCurrentTransfer(global, { state }));
});

addActionHandler('setTransferAmount', (global, actions, { amount }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      amount,
    }),
  );
});

addActionHandler('setTransferToAddress', (global, actions, { toAddress }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      toAddress,
    }),
  );
});

addActionHandler('setTransferComment', (global, actions, { comment }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      comment,
    }),
  );
});

addActionHandler('setTransferShouldEncrypt', (global, actions, { shouldEncrypt }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      shouldEncrypt,
    }),
  );
});

addActionHandler('submitTransferConfirm', (global, actions) => {
  const accountId = global.currentAccountId!;
  const account = selectAccount(global, accountId)!;

  if (account.isHardware) {
    actions.resetHardwareWalletConnect();
    global = updateCurrentTransfer(getGlobal(), { state: TransferState.ConnectHardware });
  } else {
    global = updateCurrentTransfer(global, { state: TransferState.Password });
  }

  setGlobal(global);
});

addActionHandler('clearTransferError', (global) => {
  setGlobal(updateCurrentTransfer(global, { error: undefined }));
});
