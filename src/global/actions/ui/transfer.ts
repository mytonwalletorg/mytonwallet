import { TransferState } from '../../types';

import { fromDecimal, toDecimal } from '../../../util/decimals';
import { addActionHandler, setGlobal } from '../../index';
import { setCurrentTransferAddress, updateCurrentTransfer } from '../../reducers';
import { selectEnclaveToken, selectIsEnclaveSessionValid } from '../../selectors';

addActionHandler('startTransfer', (global, actions, payload) => {
  const nftTokenSlug = Symbol('nft');
  const previousFeeTokenSlug = global.currentTransfer.nfts?.length ? nftTokenSlug : global.currentTransfer.tokenSlug;
  const nextFeeTokenSlug = payload?.nfts?.length ? nftTokenSlug : payload?.tokenSlug;
  const shouldClearFee = nextFeeTokenSlug && nextFeeTokenSlug !== previousFeeTokenSlug;

  setGlobal(updateCurrentTransfer(global, {
    state: TransferState.Initial,
    error: undefined,
    ...(shouldClearFee ? { explainedFee: undefined } : {}),
    ...payload,
  }));
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
    explainedFee: undefined,
    nfts: undefined,
  }));
});

addActionHandler('setTransferScreen', (global, actions, payload) => {
  const { state } = payload;

  return updateCurrentTransfer(global, { state });
});

addActionHandler('setTransferAmount', (global, actions, { amount }) => {
  return updateCurrentTransfer(global, { amount });
});

addActionHandler('setTransferToAddress', (global, actions, { toAddress }) => {
  return setCurrentTransferAddress(global, toAddress);
});

addActionHandler('setTransferComment', (global, actions, { comment }) => {
  return updateCurrentTransfer(global, { comment });
});

addActionHandler('setTransferShouldEncrypt', (global, actions, { shouldEncrypt }) => {
  return updateCurrentTransfer(global, { shouldEncrypt });
});

addActionHandler('submitTransferConfirm', (global, actions) => {
  if (selectIsEnclaveSessionValid(global)) {
    global = updateCurrentTransfer(global, { isLoading: true });
    actions.submitTransfer({ enclaveToken: selectEnclaveToken(global) });
  } else {
    global = updateCurrentTransfer(global, { state: TransferState.Password });
  }

  return global;
});

addActionHandler('clearTransferError', (global) => {
  setGlobal(updateCurrentTransfer(global, { error: undefined }));
});

addActionHandler('dismissTransferScamWarning', (global) => {
  global = updateCurrentTransfer(global, { scamWarningType: undefined });
  setGlobal(global);
});

addActionHandler('showTransferScamWarning', (global, actions, { type }) => {
  global = updateCurrentTransfer(global, { scamWarningType: type });
  setGlobal(global);
});
