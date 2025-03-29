import type { ApiSubmitTransferOptions } from '../../../api/methods/types';
import type { GlobalState } from '../../types';
import { ApiCommonError } from '../../../api/types';
import { MintCardState } from '../../types';

import { MINT_CARD_ADDRESS, MINT_CARD_COMMENT, TONCOIN } from '../../../config';
import { getDoesUsePinPad } from '../../../util/biometrics';
import { fromDecimal } from '../../../util/decimals';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/haptics';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getActions, getGlobal, setGlobal } from '../../index';
import {
  clearIsPinAccepted,
  setIsPinAccepted,
  updateAccountSettings,
  updateAccountState,
  updateMintCards,
} from '../../reducers';
import { selectAccountState } from '../../selectors';

addActionHandler('submitMintCard', async (global, actions, { password }) => {
  const accountId = global.currentAccountId!;
  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateMintCards(getGlobal(), { error: 'Wrong password, please try again.' }));

    return;
  }
  global = getGlobal();

  if (getDoesUsePinPad()) {
    global = setIsPinAccepted(global);
  }

  global = updateMintCards(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);
  await vibrateOnSuccess(true);

  const options = createTransferOptions(getGlobal(), password);
  const result = await callApi('submitTransfer', 'ton', options);
  const transferError = !result || 'error' in result
    ? result?.error ?? ApiCommonError.Unexpected
    : undefined;

  handleTransferResult(getGlobal(), accountId, transferError);
});

addActionHandler('submitMintCardHardware', async (global) => {
  const accountId = global.currentAccountId!;

  global = updateMintCards(global, {
    isLoading: true,
    error: undefined,
    state: MintCardState.ConfirmHardware,
  });
  setGlobal(global);

  const ledgerApi = await import('../../../util/ledger');
  const options = createTransferOptions(getGlobal(), '');
  const result = await ledgerApi.submitLedgerTransfer(options, TONCOIN.slug);
  const transferError = !result ? ApiCommonError.Unexpected : undefined;

  handleTransferResult(getGlobal(), accountId, transferError);
});

function createTransferOptions(globalState: GlobalState, password: string): ApiSubmitTransferOptions {
  const { currentAccountId, currentMintCard } = globalState;
  const { config } = selectAccountState(globalState, currentAccountId!)!;
  const { cardsInfo } = config!;
  const type = currentMintCard!.type!;
  const cardInfo = cardsInfo![type];

  return {
    accountId: currentAccountId!,
    password,
    toAddress: MINT_CARD_ADDRESS,
    amount: fromDecimal(cardInfo.price, TONCOIN.decimals),
    comment: MINT_CARD_COMMENT,
  };
}

function handleTransferResult(global: GlobalState, accountId: string, error?: string) {
  global = updateMintCards(global, { isLoading: false });
  setGlobal(global);

  if (error) {
    if (getDoesUsePinPad()) {
      global = getGlobal();
      global = clearIsPinAccepted(global);
      setGlobal(global);
    }
    void vibrateOnError();
    getActions().showError({ error });
    return;
  }

  void vibrateOnSuccess();
  global = getGlobal();
  global = updateMintCards(global, { state: MintCardState.Done });
  global = updateAccountState(global, accountId, { isCardMinting: true });
  setGlobal(global);
}

addActionHandler('checkCardNftOwnership', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) return;

  const { byAccountId } = global.settings;

  Object.entries(byAccountId).forEach(async ([accountId, settings]) => {
    const cardBackgroundNftAddress = settings.cardBackgroundNft?.address;
    const accentColorNftAddress = settings.accentColorNft?.address;

    if (!cardBackgroundNftAddress && !accentColorNftAddress) return;

    const promises = [
      cardBackgroundNftAddress
        ? callApi('checkNftOwnership', accountId, cardBackgroundNftAddress)
        : undefined,
      accentColorNftAddress && accentColorNftAddress !== cardBackgroundNftAddress
        ? callApi('checkNftOwnership', accountId, accentColorNftAddress)
        : undefined,
    ];

    const [isCardBackgroundNftOwned, isAccentColorNftOwned] = await Promise.all(promises);

    let newGlobal = getGlobal();

    if (cardBackgroundNftAddress && isCardBackgroundNftOwned === false) {
      newGlobal = updateAccountSettings(newGlobal, accountId, {
        cardBackgroundNft: undefined,
      });
    }

    if (accentColorNftAddress && (
      (accentColorNftAddress === cardBackgroundNftAddress && isCardBackgroundNftOwned === false)
      || (accentColorNftAddress !== cardBackgroundNftAddress && isAccentColorNftOwned === false)
    )) {
      newGlobal = updateAccountSettings(newGlobal, accountId, {
        accentColorNft: undefined,
        accentColorIndex: undefined,
      });
    }

    setGlobal(newGlobal);
  });
});
