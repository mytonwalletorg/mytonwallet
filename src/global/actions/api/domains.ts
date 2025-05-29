import type { ApiNft } from '../../../api/types';
import type { GlobalState } from '../../types';
import { DomainLinkingState, DomainRenewalState } from '../../types';

import { buildLocalTxId } from '../../../util/activities';
import { getDoesUsePinPad } from '../../../util/biometrics';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/haptics';
import { callApi } from '../../../api';
import { addActionHandler, getActions, getGlobal, setGlobal } from '../../index';
import {
  clearIsPinAccepted,
  setIsPinAccepted,
  updateCurrentDomainLinking,
  updateCurrentDomainRenewal,
} from '../../reducers';
import { selectCurrentAccount, selectCurrentAccountState, selectCurrentNetwork } from '../../selectors';

type DomainOperationResultError = { error: string } | undefined;
type DomainOperationResultSuccess = string;
type DomainOperationResult = Array<DomainOperationResultSuccess | DomainOperationResultError>;
type DomainOperationType = 'renewal' | 'linking';

type DomainStateUpdate<T extends DomainOperationType> = {
  isLoading: boolean;
  error?: string;
  txId?: string;
  state: T extends 'renewal' ? DomainRenewalState : DomainLinkingState;
};

type DomainStateReducer<T extends DomainOperationType> = (
  global: GlobalState,
  update: DomainStateUpdate<T>,
) => GlobalState;

function handleDomainOperationResult<T extends DomainOperationType>(
  global: GlobalState,
  result: DomainOperationResult,
  updateState: DomainStateReducer<T>,
  state: T extends 'renewal' ? DomainRenewalState : DomainLinkingState,
) {
  global = updateState(global, {
    isLoading: false,
    state,
    ...(result.length === 1 && typeof result[0] === 'string' ? { txId: buildLocalTxId(result[0], 0) } : undefined),
  });
  setGlobal(global);

  if (result.some((value) => (typeof value !== 'string'))) {
    if (getDoesUsePinPad()) {
      global = getGlobal();
      global = clearIsPinAccepted(global);
      setGlobal(global);
    }
    void vibrateOnError();
    getActions().showError({ error: 'Failed to process domain operation. Please try again.' });
    return;
  }

  void vibrateOnSuccess();
}

function prepareHardwareOperation<T extends DomainOperationType>(
  global: GlobalState,
  updateState: DomainStateReducer<T>,
  state: T extends 'renewal' ? DomainRenewalState : DomainLinkingState,
) {
  global = updateState(global, {
    isLoading: true,
    error: undefined,
    state,
  });
  setGlobal(global);

  return getGlobal();
}

async function verifyPasswordAndUpdateState(
  global: GlobalState,
  password: string,
  operationType: DomainOperationType,
) {
  if (!(await callApi('verifyPassword', password))) {
    const updateState = operationType === 'renewal' ? updateCurrentDomainRenewal : updateCurrentDomainLinking;
    setGlobal(updateState(getGlobal(), { error: 'Wrong password, please try again.' }));
    return false;
  }

  global = getGlobal();
  if (getDoesUsePinPad()) {
    global = setIsPinAccepted(global);
  }

  const updateState = operationType === 'renewal' ? updateCurrentDomainRenewal : updateCurrentDomainLinking;
  global = updateState(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);
  await vibrateOnSuccess(true);

  return true;
}

addActionHandler('checkDomainsRenewalDraft', async (global, actions, { nfts }) => {
  const accountId = global.currentAccountId!;

  const result = await callApi('checkDnsRenewalDraft', accountId, nfts);
  if (!result || 'error' in result) {
    actions.showError({ error: result?.error });
    return;
  }

  global = getGlobal();
  global = updateCurrentDomainRenewal(global, { realFee: result.realFee });
  setGlobal(global);
});

addActionHandler('submitDomainsRenewal', async (global, actions, { password }) => {
  const accountId = global.currentAccountId!;
  const nftsByAddress = selectCurrentAccountState(global)?.nfts?.byAddress;
  if (!nftsByAddress) return;

  if (!(await verifyPasswordAndUpdateState(global, password, 'renewal'))) {
    return;
  }

  global = getGlobal();

  const nftAddresses = global.currentDomainRenewal.addresses!;
  const realFee = global.currentDomainRenewal.realFee!;
  const nfts = nftAddresses
    .map((address) => nftsByAddress[address])
    .filter<ApiNft>(Boolean);

  if (!nfts.length) return;
  const result = await callApi('submitDnsRenewal', accountId, password, nfts, realFee) ?? [undefined];

  handleDomainOperationResult<'renewal'>(
    getGlobal(),
    result.map((subResult) => (
      subResult && 'msgHashNormalized' in subResult ? subResult.msgHashNormalized : subResult
    )),
    updateCurrentDomainRenewal,
    DomainRenewalState.Complete,
  );
});

addActionHandler('submitDomainsRenewalHardware', async (global) => {
  const accountId = global.currentAccountId!;
  const nftsByAddress = selectCurrentAccountState(global)?.nfts?.byAddress;
  if (!nftsByAddress) return;

  global = prepareHardwareOperation<'renewal'>(
    global,
    updateCurrentDomainRenewal,
    DomainRenewalState.ConfirmHardware,
  );

  const { realFee, addresses } = global.currentDomainRenewal;
  const nfts = addresses!
    .map((address) => nftsByAddress[address])
    .filter<ApiNft>(Boolean);
  const ledgerApi = await import('../../../util/ledger');
  const result: DomainOperationResult = [];

  for (const nft of nfts) {
    const renewResult = await ledgerApi.submitLedgerDnsRenewal(
      accountId,
      nft,
      realFee! / BigInt(nfts.length),
    );
    result.push(renewResult);
  }

  handleDomainOperationResult<'renewal'>(
    getGlobal(),
    result,
    updateCurrentDomainRenewal,
    DomainRenewalState.Complete,
  );
});

addActionHandler('checkDomainLinkingDraft', async (global, actions, { nft }) => {
  const accountId = global.currentAccountId!;
  const currentAddress = selectCurrentAccount(global)!.addressByChain.ton!;

  const result = await callApi('checkDnsChangeWalletDraft', accountId, nft, currentAddress);
  if (!result || 'error' in result) {
    actions.showError({ error: result?.error });
    return;
  }

  global = getGlobal();
  global = updateCurrentDomainLinking(global, { realFee: result.realFee });
  setGlobal(global);
});

addActionHandler('submitDomainLinking', async (global, actions, { password }) => {
  const accountId = global.currentAccountId!;
  const network = selectCurrentNetwork(global);
  const nftsByAddress = selectCurrentAccountState(global)?.nfts?.byAddress;
  const nftAddress = global.currentDomainLinking.address!;
  const realFee = global.currentDomainLinking.realFee!;
  const nft = nftsByAddress?.[nftAddress];
  const currentAddress = global.currentDomainLinking.walletAddress!;
  const checkAddressResult = await callApi('getAddressInfo', network, currentAddress);

  if (checkAddressResult && 'error' in checkAddressResult) {
    actions.showError({ error: checkAddressResult.error });
    return;
  }

  if (!nft
    || !checkAddressResult
    || ('resolvedAddress' in checkAddressResult && !checkAddressResult.resolvedAddress)
  ) return;

  if (!(await verifyPasswordAndUpdateState(global, password, 'linking'))) {
    return;
  }

  const result = await callApi(
    'submitDnsChangeWallet',
    accountId,
    password,
    nft,
    checkAddressResult.resolvedAddress!,
    realFee,
  );

  handleDomainOperationResult<'linking'>(
    getGlobal(),
    [result && 'msgHashNormalized' in result ? result.msgHashNormalized : result],
    updateCurrentDomainLinking,
    DomainLinkingState.Complete,
  );
});

addActionHandler('submitDomainLinkingHardware', async (global, actions) => {
  const accountId = global.currentAccountId!;
  const network = selectCurrentNetwork(global);
  const nftsByAddress = selectCurrentAccountState(global)?.nfts?.byAddress;
  const nft = nftsByAddress?.[global.currentDomainLinking.address!];
  const currentAddress = global.currentDomainLinking.walletAddress!;
  const checkAddressResult = await callApi('getAddressInfo', network, currentAddress);
  global = getGlobal();

  if (checkAddressResult && 'error' in checkAddressResult) {
    actions.showError({ error: checkAddressResult.error });
    return;
  }

  if (!nft
    || !checkAddressResult
    || ('resolvedAddress' in checkAddressResult && !checkAddressResult.resolvedAddress)
  ) return;

  global = prepareHardwareOperation<'linking'>(
    global,
    updateCurrentDomainLinking,
    DomainLinkingState.ConfirmHardware,
  );

  const { realFee } = global.currentDomainLinking;
  const ledgerApi = await import('../../../util/ledger');

  const result = await ledgerApi.submitLedgerDnsChangeWallet(
    accountId,
    nft,
    checkAddressResult.resolvedAddress!,
    realFee!,
  );

  handleDomainOperationResult<'linking'>(
    getGlobal(),
    [result],
    updateCurrentDomainLinking,
    DomainLinkingState.Complete,
  );
});

addActionHandler('checkLinkingAddress', async (global, actions, { address }) => {
  if (!address) {
    global = updateCurrentDomainLinking(global, { walletAddressName: undefined, resolvedWalletAddress: undefined });
    setGlobal(global);

    return;
  }

  const network = selectCurrentNetwork(global);
  const result = await callApi('getAddressInfo', network, address);

  global = getGlobal();
  if (!result || 'error' in result) {
    global = updateCurrentDomainLinking(global, { walletAddressName: undefined, resolvedWalletAddress: undefined });
  } else {
    global = updateCurrentDomainLinking(global, {
      walletAddressName: result.addressName,
      resolvedWalletAddress: result.resolvedAddress,
    });
  }
  setGlobal(global);
});
