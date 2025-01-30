import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import type { ApiChain } from '../../../api/types';
import type { LedgerTransport } from '../../../util/ledger/types';
import type { GlobalState } from '../../types';
import {
  AppState, AuthState, HardwareConnectState, SettingsState, SwapState, TransferState,
} from '../../types';

import {
  ANIMATION_LEVEL_MIN,
  APP_VERSION,
  BETA_URL,
  BOT_USERNAME,
  CHAIN_CONFIG,
  DEBUG,
  IS_CAPACITOR,
  IS_EXTENSION,
  IS_PRODUCTION,
  PRODUCTION_URL,
  TONCOIN,
} from '../../../config';
import {
  ACCENT_BNW_INDEX,
  ACCENT_GOLD_INDEX,
  ACCENT_RADIOACTIVE_INDEX,
  ACCENT_SILVER_INDEX,
  extractAccentColorIndex,
} from '../../../util/accentColor';
import { vibrateOnSuccess } from '../../../util/capacitor';
import { isTonDeeplink, parseTonDeeplink, processDeeplink } from '../../../util/deeplink';
import { getCachedImageUrl } from '../../../util/getCachedImageUrl';
import getIsAppUpdateNeeded from '../../../util/getIsAppUpdateNeeded';
import { isValidAddressOrDomain } from '../../../util/isValidAddressOrDomain';
import { omitUndefined, pick } from '../../../util/iteratees';
import { getTranslation } from '../../../util/langProvider';
import { onLedgerTabClose, openLedgerTab } from '../../../util/ledger/tab';
import { callActionInMain, callActionInNative } from '../../../util/multitab';
import { openUrl } from '../../../util/openUrl';
import { preloadImage } from '../../../util/preloadImage';
import { pause } from '../../../util/schedulers';
import {
  IS_ANDROID_APP,
  IS_BIOMETRIC_AUTH_SUPPORTED,
  IS_DELEGATED_BOTTOM_SHEET,
  IS_DELEGATING_BOTTOM_SHEET,
} from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentSwap,
  clearCurrentTransfer,
  clearIsPinAccepted,
  renameAccount,
  setIsPinAccepted,
  updateAccounts,
  updateAuth,
  updateCurrentAccountSettings,
  updateCurrentAccountState,
  updateCurrentSwap,
  updateCurrentTransfer,
  updateHardware,
  updateSettings,
} from '../../reducers';
import {
  selectCurrentAccount,
  selectCurrentAccountSettings,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectFirstNonHardwareAccount,
  selectIsMultichainAccount,
} from '../../selectors';
import { switchAccount } from '../api/auth';

import { reportAppLockActivityEvent } from '../../../components/AppLocked';
import { getCardNftImageUrl } from '../../../components/main/sections/Card/helpers/getCardNftImageUrl';
import { closeModal } from '../../../components/ui/Modal';

const OPEN_LEDGER_TAB_DELAY = 500;
const APP_VERSION_URL = IS_ANDROID_APP ? `${IS_PRODUCTION ? PRODUCTION_URL : BETA_URL}/version.txt` : 'version.txt';

addActionHandler('showActivityInfo', (global, actions, { id }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('showActivityInfo', { id });
    return undefined;
  }

  return updateCurrentAccountState(global, { currentActivityId: id });
});

addActionHandler('showAnyAccountTx', async (global, actions, { txId, accountId, network }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('showAnyAccountTx', { txId, accountId, network });
    return;
  }

  await switchAccount(global, accountId, network);

  actions.showActivityInfo({ id: txId });
});

addActionHandler('showAnyAccountTokenActivity', async (global, actions, { slug, accountId, network }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('showAnyAccountTokenActivity', { slug, accountId, network });
    return;
  }

  await switchAccount(global, accountId, network);

  actions.showTokenActivity({ slug });
});

addActionHandler('closeActivityInfo', (global, actions, { id }) => {
  if (selectCurrentAccountState(global)?.currentActivityId !== id) {
    return undefined;
  }

  return updateCurrentAccountState(global, { currentActivityId: undefined });
});

addActionHandler('addSavedAddress', (global, actions, { address, name, chain }) => {
  const { savedAddresses = [] } = selectCurrentAccountState(global) || {};

  return updateCurrentAccountState(global, {
    savedAddresses: [
      ...savedAddresses,
      { address, name, chain },
    ],
  });
});

addActionHandler('removeFromSavedAddress', (global, actions, { address, chain }) => {
  const { savedAddresses = [] } = selectCurrentAccountState(global) || {};

  const newSavedAddresses = savedAddresses.filter((item) => !(item.address === address && item.chain === chain));

  return updateCurrentAccountState(global, { savedAddresses: newSavedAddresses });
});

addActionHandler('toggleTinyTransfersHidden', (global, actions, { isEnabled } = {}) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      areTinyTransfersHidden: isEnabled,
    },
  };
});

addActionHandler('setCurrentTokenPeriod', (global, actions, { period }) => {
  return updateCurrentAccountState(global, {
    currentTokenPeriod: period,
  });
});

addActionHandler('addAccount', async (global, actions, { method, password, isAuthFlow }) => {
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);
  const isMnemonicImport = method === 'importMnemonic';

  if (firstNonHardwareAccount) {
    if (!(await callApi('verifyPassword', password))) {
      global = getGlobal();
      if (isAuthFlow) {
        global = updateAuth(global, {
          isLoading: undefined,
          error: 'Wrong password, please try again.',
        });
      } else {
        global = updateAccounts(getGlobal(), {
          isLoading: undefined,
          error: 'Wrong password, please try again.',
        });
      }
      setGlobal(global);
      return;
    }

    if (IS_CAPACITOR) {
      global = setIsPinAccepted(getGlobal());
      setGlobal(global);

      await vibrateOnSuccess(true);
    }
  }

  global = getGlobal();
  if (isMnemonicImport || !firstNonHardwareAccount) {
    global = { ...global, isAddAccountModalOpen: undefined };
  } else {
    global = updateAccounts(global, { isLoading: true });
  }
  setGlobal(global);

  if (!IS_DELEGATED_BOTTOM_SHEET) {
    actions.addAccount2({ method, password });
  } else {
    callActionInMain('addAccount2', { method, password });
  }
});

addActionHandler('addAccount2', (global, actions, { method, password }) => {
  const isMnemonicImport = method === 'importMnemonic';
  const firstNonHardwareAccount = selectFirstNonHardwareAccount(global);
  const authState = firstNonHardwareAccount
    ? isMnemonicImport
      ? AuthState.importWallet
      : undefined
    : (
      IS_CAPACITOR
        ? AuthState.createPin
        : (IS_BIOMETRIC_AUTH_SUPPORTED ? AuthState.createBiometrics : AuthState.createPassword)
    );

  if (isMnemonicImport || !firstNonHardwareAccount) {
    global = { ...global, appState: AppState.Auth };
  }
  global = updateAuth(global, { password, state: authState });
  global = clearCurrentTransfer(global);
  global = clearCurrentSwap(global);

  setGlobal(global);

  if (isMnemonicImport) {
    actions.startImportingWallet();
  } else {
    actions.startCreatingWallet();
  }
});

addActionHandler('renameAccount', (global, actions, { accountId, title }) => {
  global = { ...global, shouldForceAccountEdit: false };

  setGlobal(renameAccount(global, accountId, title));

  actions.renameNotificationAccount({ accountId });
});

addActionHandler('clearAccountError', (global) => {
  return updateAccounts(global, { error: undefined });
});

addActionHandler('openAddAccountModal', (global, actions, props) => {
  if (IS_DELEGATED_BOTTOM_SHEET && !global.areSettingsOpen) {
    callActionInMain('openAddAccountModal', props);
    return;
  }

  global = { ...global, isAddAccountModalOpen: true };
  setGlobal(global);
});

addActionHandler('closeAddAccountModal', (global) => {
  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }

  return { ...global, isAddAccountModalOpen: undefined };
});

addActionHandler('changeNetwork', (global, actions, { network }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      isTestnet: network === 'testnet',
    },
  };
});

addActionHandler('openSettings', (global) => {
  global = updateSettings(global, { state: SettingsState.Initial });
  setGlobal({ ...global, areSettingsOpen: true });
});

addActionHandler('openSettingsWithState', (global, actions, { state }) => {
  if (IS_DELEGATED_BOTTOM_SHEET && !global.areSettingsOpen) {
    callActionInMain('openSettingsWithState', { state });
    return;
  }

  global = updateSettings(global, { state });
  setGlobal({ ...global, areSettingsOpen: true });
});

addActionHandler('setSettingsState', (global, actions, { state }) => {
  global = updateSettings(global, { state });
  setGlobal(global);
});

addActionHandler('closeSettings', (global) => {
  if (!global.currentAccountId) {
    return global;
  }

  return { ...global, areSettingsOpen: false };
});

addActionHandler('openBackupWalletModal', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openBackupWalletModal');
    return undefined;
  }

  return { ...global, isBackupWalletModalOpen: true };
});

addActionHandler('closeBackupWalletModal', (global) => {
  return { ...global, isBackupWalletModalOpen: undefined };
});

addActionHandler('initializeHardwareWalletModal', async (global, actions) => {
  const ledgerApi = await import('../../../util/ledger');
  const { isBluetoothAvailable, isUsbAvailable } = await ledgerApi.detectAvailableTransports();
  const availableTransports: LedgerTransport[] = [];
  if (isUsbAvailable) {
    availableTransports.push('usb');
  }
  if (isBluetoothAvailable) {
    availableTransports.push('bluetooth');
  }

  if (availableTransports.length === 0) {
    actions.showNotification({
      message: 'Ledger is not supported on this device.',
    });
  } else if (availableTransports.length === 1) {
    actions.initializeHardwareWalletConnection({ transport: availableTransports[0] });
  } else {
    global = updateHardware(getGlobal(), {
      availableTransports,
    });
    setGlobal(global);
  }
});

addActionHandler('initializeHardwareWalletConnection', async (global, actions, params) => {
  if (IS_DELEGATING_BOTTOM_SHEET && params.shouldDelegateToNative) {
    callActionInNative('initializeHardwareWalletConnection', { transport: params.transport });
    return;
  }

  const setHardwareStateToConnecting = () => {
    global = getGlobal();
    global = updateHardware(getGlobal(), {
      hardwareState: HardwareConnectState.Connecting,
    });
    setGlobal(global);
  };

  setHardwareStateToConnecting();
  const ledgerApi = await import('../../../util/ledger');

  if (await ledgerApi.connectLedger(params.transport)) {
    actions.connectHardwareWallet({ transport: params.transport });
    return;
  }

  if (!IS_EXTENSION) {
    global = getGlobal();
    global = updateHardware(global, {
      isLedgerConnected: false,
      hardwareState: HardwareConnectState.Failed,
    });
    setGlobal(global);
    return;
  }

  global = updateHardware(getGlobal(), {
    hardwareState: HardwareConnectState.WaitingForBrowser,
  });
  setGlobal(global);

  await pause(OPEN_LEDGER_TAB_DELAY);
  const id = await openLedgerTab();
  const popup = await chrome.windows.getCurrent();

  onLedgerTabClose(id, async () => {
    await chrome.windows.update(popup.id!, { focused: true });

    if (!await ledgerApi.connectLedger(params.transport)) {
      actions.closeHardwareWalletModal();
      return;
    }

    setHardwareStateToConnecting();
    actions.connectHardwareWallet({ transport: params.transport });
  });
});

addActionHandler('openHardwareWalletModal', async (global) => {
  const hardwareState = await connectLedgerAndGetHardwareState();

  global = updateHardware(getGlobal(), { hardwareState });

  setGlobal({ ...global, isHardwareModalOpen: true });
});

addActionHandler('openSettingsHardwareWallet', async (global) => {
  const hardwareState = await connectLedgerAndGetHardwareState();

  global = updateHardware(getGlobal(), { hardwareState });
  global = updateSettings(global, { state: SettingsState.LedgerConnectHardware });

  setGlobal(global);
});

addActionHandler('closeHardwareWalletModal', (global) => {
  setGlobal({ ...global, isHardwareModalOpen: false });
});

addActionHandler('toggleInvestorView', (global, actions, { isEnabled } = {}) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      isInvestorViewEnabled: isEnabled,
    },
  };
});

addActionHandler('changeLanguage', (global, actions, { langCode }) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      langCode,
    },
  };
});

addActionHandler('toggleCanPlaySounds', (global, actions, { isEnabled } = {}) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      canPlaySounds: isEnabled,
    },
  };
});

addActionHandler('setLandscapeActionsActiveTabIndex', (global, actions, { index }) => {
  return updateCurrentAccountState(global, {
    landscapeActionsActiveTabIndex: index,
  });
});

addActionHandler('closeSecurityWarning', (global) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      isSecurityWarningHidden: true,
    },
  };
});

addActionHandler('toggleTokensWithNoCost', (global, actions, { isEnabled }) => {
  return updateSettings(global, { areTokensWithNoCostHidden: isEnabled });
});

addActionHandler('toggleSortByValue', (global, actions, { isEnabled }) => {
  return updateSettings(global, { isSortByValueEnabled: isEnabled });
});

addActionHandler('updateOrderedSlugs', (global, actions, { orderedSlugs }) => {
  const accountSettings = selectCurrentAccountSettings(global);
  return updateCurrentAccountSettings(global, {
    ...accountSettings,
    orderedSlugs,
  });
});

addActionHandler('toggleTokenVisibility', (global, actions, { slug, shouldShow }) => {
  const accountSettings = selectCurrentAccountSettings(global) ?? {};
  const { alwaysShownSlugs = [], alwaysHiddenSlugs = [] } = accountSettings;
  const alwaysShownSlugsSet = new Set(alwaysShownSlugs);
  const alwaysHiddenSlugsSet = new Set(alwaysHiddenSlugs);

  if (shouldShow) {
    alwaysHiddenSlugsSet.delete(slug);
    alwaysShownSlugsSet.add(slug);
  } else {
    alwaysShownSlugsSet.delete(slug);
    alwaysHiddenSlugsSet.add(slug);
  }

  return updateCurrentAccountSettings(global, {
    ...accountSettings,
    alwaysHiddenSlugs: Array.from(alwaysHiddenSlugsSet),
    alwaysShownSlugs: Array.from(alwaysShownSlugsSet),
  });
});

addActionHandler('deleteToken', (global, actions, { slug }) => {
  const accountSettings = selectCurrentAccountSettings(global) ?? {};
  return updateCurrentAccountSettings(global, {
    ...accountSettings,
    orderedSlugs: accountSettings.orderedSlugs?.filter((s) => s !== slug),
    alwaysHiddenSlugs: accountSettings.alwaysHiddenSlugs?.filter((s) => s !== slug),
    alwaysShownSlugs: accountSettings.alwaysShownSlugs?.filter((s) => s !== slug),
    deletedSlugs: [...accountSettings.deletedSlugs ?? [], slug],
    importedSlugs: accountSettings.importedSlugs?.filter((s) => s !== slug),
  });
});

addActionHandler('checkAppVersion', (global) => {
  fetch(`${APP_VERSION_URL}?${Date.now()}`)
    .then((response) => response.text())
    .then((version) => {
      version = version.trim();

      if (getIsAppUpdateNeeded(version, APP_VERSION)) {
        global = getGlobal();
        global = {
          ...global,
          isAppUpdateAvailable: true,
          latestAppVersion: version.trim(),
        };
        setGlobal(global);
      }
    })
    .catch((err) => {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[checkAppVersion failed] ', err);
      }
    });
});

addActionHandler('requestConfetti', (global) => {
  if (global.settings.animationLevel === ANIMATION_LEVEL_MIN) return global;

  return {
    ...global,
    confettiRequestedAt: Date.now(),
  };
});

addActionHandler('requestOpenQrScanner', async (global, actions) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('requestOpenQrScanner');
    return;
  }

  let currentQrScan: GlobalState['currentQrScan'];
  if (global.currentTransfer.state === TransferState.Initial) {
    currentQrScan = { currentTransfer: global.currentTransfer };
  } else if (global.currentSwap.state === SwapState.Blockchain) {
    currentQrScan = { currentSwap: global.currentSwap };
  }

  const { camera } = await BarcodeScanner.requestPermissions();
  const isGranted = camera === 'granted' || camera === 'limited';
  if (!isGranted) {
    actions.showNotification({
      message: getTranslation('Permission denied. Please grant camera permission to use the QR code scanner.'),
    });
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    isQrScannerOpen: true,
    currentQrScan,
  };

  setGlobal(global);
});

addActionHandler('closeQrScanner', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('closeQrScanner');
  }

  return {
    ...global,
    isQrScannerOpen: undefined,
    currentQrScan: undefined,
  };
});

addActionHandler('handleQrCode', (global, actions, { data }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('handleQrCode', { data });
    return undefined;
  }

  const { currentTransfer, currentSwap } = global.currentQrScan || {};
  const isMultichain = selectIsMultichainAccount(global, global.currentAccountId!);

  if (currentTransfer) {
    const chainFromAddress = getChainFromAddress(data, isMultichain);

    if (chainFromAddress) {
      const { tokenSlug } = currentTransfer;

      const token = selectCurrentAccountTokens(global)?.find(({ slug }) => slug === tokenSlug);

      const newTokenSlug = (!token || token.chain !== chainFromAddress)
        ? CHAIN_CONFIG[chainFromAddress].nativeToken.slug
        : tokenSlug;

      return updateCurrentTransfer(global, {
        ...currentTransfer,
        tokenSlug: newTokenSlug,
        toAddress: data,
      });
    }

    const linkParams = isTonDeeplink(data) ? parseTonDeeplink(data) : undefined;
    if (linkParams) {
      return updateCurrentTransfer(global, {
        ...currentTransfer,
        // For NFT transfer we only extract address from a ton:// link
        ...(currentTransfer.nfts?.length ? pick(linkParams, ['toAddress']) : omitUndefined(linkParams)),
        // Only Toncoin can be processed with deeplink right now
        tokenSlug: TONCOIN.slug,
      });
    }
  }

  if (currentSwap) {
    return updateCurrentSwap(global, {
      ...currentSwap,
      toAddress: data,
    });
  }

  processDeeplink(data);

  return undefined;
});

addActionHandler('changeBaseCurrency', async (global, actions, { currency }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('changeBaseCurrency', { currency });
  }

  await callApi('setBaseCurrency', currency);
  await callApi('tryUpdatePrices');

  await Promise.all([
    callApi('tryUpdateTokens'),
    callApi('tryUpdateSwapTokens'),
  ]);
});

addActionHandler('setIsPinAccepted', (global) => {
  return setIsPinAccepted(global);
});

addActionHandler('clearIsPinAccepted', (global) => {
  return clearIsPinAccepted(global);
});

addActionHandler('openOnRampWidgetModal', (global, actions, { chain }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openOnRampWidgetModal', { chain });
    return;
  }

  setGlobal({ ...global, chainForOnRampWidgetModal: chain });
});

addActionHandler('closeOnRampWidgetModal', (global) => {
  setGlobal({ ...global, chainForOnRampWidgetModal: undefined });
});

addActionHandler('openMediaViewer', (global, actions, {
  mediaId, mediaType, txId, hiddenNfts, noGhostAnimation,
}) => {
  return {
    ...global,
    mediaViewer: {
      mediaId,
      mediaType,
      txId,
      hiddenNfts,
      noGhostAnimation,
    },
  };
});

addActionHandler('closeMediaViewer', (global) => {
  return {
    ...global,
    mediaViewer: {
      mediaId: undefined,
      mediaType: undefined,
    },
  };
});

addActionHandler('openReceiveModal', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openReceiveModal');
    return;
  }

  setGlobal({ ...global, isReceiveModalOpen: true });
});

addActionHandler('closeReceiveModal', (global) => {
  setGlobal({ ...global, isReceiveModalOpen: undefined });
});

addActionHandler('openInvoiceModal', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openInvoiceModal');
    return;
  }
  setGlobal({ ...global, isInvoiceModalOpen: true });
});

addActionHandler('closeInvoiceModal', (global) => {
  setGlobal({ ...global, isInvoiceModalOpen: undefined });
});

addActionHandler('showIncorrectTimeError', (global, actions) => {
  actions.showDialog({
    message: getTranslation('Time synchronization issue. Please ensure your device\'s time settings are correct.'),
  });

  return { ...global, isIncorrectTimeNotificationReceived: true };
});

addActionHandler('initLedgerPage', (global) => {
  global = updateHardware(global, {
    isRemoteTab: true,
  });
  setGlobal({ ...global, appState: AppState.Ledger });
});

addActionHandler('openLoadingOverlay', (global) => {
  setGlobal({ ...global, isLoadingOverlayOpen: true });
});

addActionHandler('closeLoadingOverlay', (global) => {
  setGlobal({ ...global, isLoadingOverlayOpen: undefined });
});

addActionHandler('clearAccountLoading', (global) => {
  setGlobal(updateAccounts(global, { isLoading: undefined }));
});

addActionHandler('authorizeDiesel', (global) => {
  const address = selectCurrentAccount(global)!.addressByChain.ton;
  setGlobal(updateCurrentAccountState(global, { isDieselAuthorizationStarted: true }));
  openUrl(`https://t.me/${BOT_USERNAME}?start=auth-${address}`, true);
});

addActionHandler('submitAppLockActivityEvent', () => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitAppLockActivityEvent');
    return;
  }
  reportAppLockActivityEvent();
});

addActionHandler('setCardBackgroundNft', (global, actions, { nft }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('setCardBackgroundNft', { nft });
    return;
  }

  global = updateCurrentAccountSettings(global, { cardBackgroundNft: nft });
  setGlobal(global);
});

addActionHandler('clearCardBackgroundNft', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('clearCardBackgroundNft');
    return;
  }

  global = updateCurrentAccountSettings(global, { cardBackgroundNft: undefined });
  setGlobal(global);
});

addActionHandler('installAccentColorFromNft', async (global, actions, { nft }) => {
  const { mtwCardType, mtwCardBorderShineType } = nft.metadata!;

  let accentColorIndex: number | undefined;
  if (mtwCardBorderShineType === 'radioactive') {
    accentColorIndex = ACCENT_RADIOACTIVE_INDEX;
  } else if (mtwCardType === 'silver') {
    accentColorIndex = ACCENT_SILVER_INDEX;
  } else if (mtwCardType === 'gold') {
    accentColorIndex = ACCENT_GOLD_INDEX;
  } else if (mtwCardType === 'platinum' || mtwCardType === 'black') {
    accentColorIndex = ACCENT_BNW_INDEX;
  } else {
    const src = getCardNftImageUrl(nft);
    if (!src) return;

    const cachedBlobUrl = await getCachedImageUrl(src);
    const img = await preloadImage(cachedBlobUrl);
    accentColorIndex = extractAccentColorIndex(img);
    URL.revokeObjectURL(cachedBlobUrl);

    if (!accentColorIndex) return;
  }

  global = getGlobal();
  global = updateCurrentAccountSettings(global, {
    accentColorNft: nft,
    accentColorIndex,
  });
  setGlobal(global);
});

addActionHandler('clearAccentColorFromNft', (global) => {
  return updateCurrentAccountSettings(global, {
    accentColorNft: undefined,
    accentColorIndex: undefined,
  });
});

addActionHandler('closeAnyModal', () => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('closeAnyModal');
    return;
  }

  closeModal();
});

addActionHandler('closeAllOverlays', (global, actions) => {
  actions.closeAnyModal();
  actions.closeMediaViewer();
});

async function connectLedgerAndGetHardwareState() {
  const ledgerApi = await import('../../../util/ledger');
  let newHardwareState;

  // If not running in the Capacitor environment, try to instantly connect to the Ledger
  const isConnected = !IS_CAPACITOR ? await ledgerApi.connectLedger() : false;

  if (!isConnected && IS_EXTENSION) {
    newHardwareState = HardwareConnectState.WaitingForBrowser;
  } else {
    newHardwareState = HardwareConnectState.Connect;
  }

  return newHardwareState;
}

function getChainFromAddress(address: string, isMultichainAccount: boolean): ApiChain | undefined {
  if (isMultichainAccount && isValidAddressOrDomain(address, 'tron')) return 'tron';

  return isValidAddressOrDomain(address, 'ton') ? 'ton' : undefined;
}
