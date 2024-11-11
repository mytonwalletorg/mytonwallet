import type { ApiSubmitTransferWithDieselResult } from '../../../api/chains/ton/types';
import type { ApiSubmitTransferOptions, ApiSubmitTransferResult } from '../../../api/methods/types';
import type {
  ApiChain,
  ApiSwapBuildRequest,
  ApiSwapCexCreateTransactionRequest,
  ApiSwapHistoryItem,
  ApiSwapPairAsset,
} from '../../../api/types';
import type {
  AssetPairs,
  GlobalState,
} from '../../types';
import { ApiCommonError } from '../../../api/types';
import {
  ActiveTab,
  SwapErrorType,
  SwapFeeSource,
  SwapInputSource,
  SwapState,
  SwapType,
} from '../../types';

import {
  DEFAULT_FEE,
  DEFAULT_SWAP_SECOND_TOKEN_SLUG,
  IS_CAPACITOR,
  TONCOIN,
  TRX,
  TRX_SWAP_COUNT_FEE_ADDRESS,
} from '../../../config';
import { Big } from '../../../lib/big.js';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/capacitor';
import { getChainConfig } from '../../../util/chain';
import {
  fromDecimal, getIsPositiveDecimal, roundDecimal, toDecimal,
} from '../../../util/decimals';
import generateUniqueId from '../../../util/generateUniqueId';
import { buildCollectionByKey, pick } from '../../../util/iteratees';
import { callActionInMain, callActionInNative } from '../../../util/multitab';
import { pause } from '../../../util/schedulers';
import { buildSwapId } from '../../../util/swap/buildSwapId';
import { getIsTonToken } from '../../../util/tokens';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../..';
import { resolveSwapAssetId } from '../../helpers';
import {
  clearCurrentSwap,
  clearIsPinAccepted,
  setIsPinAccepted,
  updateAccountState,
  updateCurrentSwap,
} from '../../reducers';
import {
  selectAccount,
  selectAccountState,
  selectCurrentAccount,
  selectCurrentToncoinBalance,
  selectIsMultichainAccount,
} from '../../selectors';

import { getIsPortrait } from '../../../hooks/useDeviceScreen';

let pairsCache: Record<string, { data: ApiSwapPairAsset[]; timestamp: number }> = {};

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const WAIT_FOR_CHANGELLY = 5 * 1000;
const CLOSING_BOTTOM_SHEET_DURATION = 100; // Like in `useDelegatingBottomSheet`
let isEstimateSwapBeingExecuted = false;
let isEstimateCexSwapBeingExecuted = false;

const SERVER_ERRORS_MAP = {
  'Insufficient liquidity': SwapErrorType.NotEnoughLiquidity,
  'Tokens must be different': SwapErrorType.InvalidPair,
  'Asset not found': SwapErrorType.InvalidPair,
  'Pair not found': SwapErrorType.InvalidPair,
  'Too small amount': SwapErrorType.TooSmallAmount,
};

function buildSwapBuildRequest(global: GlobalState): ApiSwapBuildRequest {
  const {
    dexLabel,
    amountIn,
    amountOut,
    amountOutMin,
    tokenInSlug,
    tokenOutSlug,
    slippage,
    networkFee,
    swapFee,
  } = global.currentSwap;

  const tokenIn = global.swapTokenInfo!.bySlug[tokenInSlug!];
  const tokenOut = global.swapTokenInfo!.bySlug[tokenOutSlug!];
  const from = resolveSwapAssetId(tokenIn);
  const to = resolveSwapAssetId(tokenOut);
  const fromAmount = amountIn!;
  const toAmount = amountOut!;
  const account = selectAccount(global, global.currentAccountId!);
  const shouldTryDiesel = networkFee
    ? selectCurrentToncoinBalance(global) < (fromDecimal(networkFee) + DEFAULT_FEE)
    && global.currentSwap.dieselStatus === 'available'
    : undefined;

  return {
    from,
    to,
    fromAmount,
    toAmount,
    toMinAmount: amountOutMin!,
    slippage,
    fromAddress: account?.addressByChain[tokenIn.chain as ApiChain] || account?.addressByChain.ton!,
    dexLabel: dexLabel!,
    networkFee: networkFee!,
    swapFee: swapFee!,
    shouldTryDiesel,
  };
}

function getSupportedChains(global: GlobalState) {
  return Object.keys(selectAccount(global, global.currentAccountId!)?.addressByChain || { ton: true }) as ApiChain[];
}

addActionHandler('startSwap', async (global, actions, payload) => {
  const isOpen = global.currentSwap.state !== SwapState.None;
  if (IS_DELEGATING_BOTTOM_SHEET && isOpen) {
    callActionInNative('cancelSwap');
    await pause(CLOSING_BOTTOM_SHEET_DURATION);
    global = getGlobal();
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('startSwap', payload);
    return;
  }

  const {
    state, tokenInSlug, tokenOutSlug, amountIn, toAddress,
  } = payload ?? {};
  const isPortrait = getIsPortrait();

  if (tokenInSlug || tokenOutSlug || amountIn || toAddress) {
    const tokenIn = global.swapTokenInfo?.bySlug[tokenInSlug!];
    const tokenOut = global.swapTokenInfo?.bySlug[tokenOutSlug!];
    const account = selectAccount(global, global.currentAccountId!);

    const isCrosschain = tokenIn?.chain !== 'ton' || tokenOut?.chain !== 'ton';
    const isToSupportedChain = Boolean(account?.addressByChain[tokenOut?.chain as ApiChain]);

    const swapType = isCrosschain
      ? (isToSupportedChain ? SwapType.CrosschainToWallet : SwapType.CrosschainFromWallet)
      : SwapType.OnChain;

    global = updateCurrentSwap(global, {
      ...payload,
      isEstimating: true,
      shouldEstimate: true,
      inputSource: SwapInputSource.In,
      swapType,
    });
  }

  const requiredState = state || (isPortrait ? SwapState.Initial : SwapState.None);

  global = updateCurrentSwap(global, {
    state: requiredState,
    swapId: generateUniqueId(),
  });
  setGlobal(global);

  if (!isPortrait) {
    actions.setLandscapeActionsActiveTabIndex({ index: ActiveTab.Swap });
  }
});

addActionHandler('setDefaultSwapParams', (global, actions, payload) => {
  let { tokenInSlug: requiredTokenInSlug, tokenOutSlug: requiredTokenOutSlug } = payload ?? {};

  requiredTokenInSlug = requiredTokenInSlug || TONCOIN.slug;
  requiredTokenOutSlug = requiredTokenOutSlug || DEFAULT_SWAP_SECOND_TOKEN_SLUG;

  global = updateCurrentSwap(global, {
    tokenInSlug: requiredTokenInSlug,
    tokenOutSlug: requiredTokenOutSlug,
    priceImpact: 0,
    transactionFee: '0',
    swapFee: '0',
    networkFee: 0,
    amountOutMin: '0',
    inputSource: SwapInputSource.In,
  });
  setGlobal(global);
});

addActionHandler('cancelSwap', (global, actions, { shouldReset } = {}) => {
  if (shouldReset) {
    const {
      tokenInSlug, tokenOutSlug, pairs, swapType,
    } = global.currentSwap;

    global = clearCurrentSwap(global);
    global = updateCurrentSwap(global, {
      tokenInSlug,
      tokenOutSlug,
      priceImpact: 0,
      transactionFee: undefined,
      swapFee: undefined,
      networkFee: 0,
      realNetworkFee: 0,
      amountIn: undefined,
      amountOutMin: undefined,
      amountOut: undefined,
      inputSource: SwapInputSource.In,
      swapType,
      pairs,
    });

    setGlobal(global);
    return;
  }

  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }
  global = updateCurrentSwap(global, {
    state: SwapState.None,
    swapId: undefined,
  });
  setGlobal(global);
});

addActionHandler('submitSwap', async (global, actions, { password }) => {
  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentSwap(
      getGlobal(),
      { error: 'Wrong password, please try again.' },
    ));

    return;
  }

  global = getGlobal();
  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }
  global = updateCurrentSwap(global, {
    isLoading: true,
    shouldResetOnClose: undefined,
    error: undefined,
  });
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  const swapBuildRequest = buildSwapBuildRequest(global);
  const buildResult = await callApi(
    'swapBuildTransfer', global.currentAccountId!, password, swapBuildRequest,
  );
  global = getGlobal();

  if (!buildResult || 'error' in buildResult) {
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
      void vibrateOnError();
    }
    global = updateCurrentSwap(global, {
      shouldResetOnClose: true,
      isLoading: false,
    });
    setGlobal(global);

    actions.showError({ error: buildResult?.error });

    return;
  }

  const swapHistoryItem: ApiSwapHistoryItem = {
    id: buildResult.id,
    timestamp: Date.now(),
    status: 'pending',
    from: swapBuildRequest.from,
    fromAmount: swapBuildRequest.fromAmount,
    to: swapBuildRequest.to,
    toAmount: swapBuildRequest.toAmount,
    networkFee: global.currentSwap.networkFee!,
    swapFee: global.currentSwap.swapFee!,
    txIds: [],
  };

  global = updateCurrentSwap(global, {
    tokenInSlug: undefined,
    tokenOutSlug: undefined,
    amountIn: undefined,
    amountOut: undefined,
    isLoading: false,
    state: SwapState.Complete,
    activityId: buildSwapId(buildResult.id),
    shouldResetOnClose: true,
  });
  setGlobal(global);
  if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }

  const result = await callApi(
    'swapSubmit',
    global.currentAccountId!,
    password,
    buildResult.transfers,
    swapHistoryItem,
    swapBuildRequest.shouldTryDiesel,
  );

  if (!result || 'error' in result) {
    global = getGlobal();
    global = updateCurrentSwap(global, { shouldResetOnClose: true });
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
    }

    setGlobal(global);
    void vibrateOnError();

    actions.showError({ error: result?.error });
  }
});

addActionHandler('submitSwapCex', async (global, actions, { password }) => {
  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentSwap(
      getGlobal(),
      { error: 'Wrong password, please try again.' },
    ));

    return;
  }

  global = getGlobal();
  global = updateCurrentSwap(global, {
    isLoading: true,
    error: undefined,
    shouldResetOnClose: undefined,
  });
  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
    global = getGlobal();
  }

  const isMutlichainAccount = selectIsMultichainAccount(global, global.currentAccountId!);
  const account = selectCurrentAccount(global);
  const supportedChains = getSupportedChains(global);
  const tokenIn = global.swapTokenInfo.bySlug[global.currentSwap.tokenInSlug!];
  const tokenOut = global.swapTokenInfo.bySlug[global.currentSwap.tokenOutSlug!];
  const shouldSendTonTransaction = tokenIn.chain === 'ton';
  const shouldSendTronTransaction = isMutlichainAccount && tokenIn.chain === 'tron';
  const shouldSendTransaction = shouldSendTonTransaction || shouldSendTronTransaction;
  const shouldSendTokenToExternalWallet = isMutlichainAccount
    ? supportedChains.includes(tokenIn.chain as ApiChain)
    : tokenIn.chain === 'ton';

  const tonAddress = account!.addressByChain.ton;
  const toAddress = account?.addressByChain[tokenOut.chain as ApiChain] ?? global.currentSwap.toAddress!;

  const swapBuildRequest = buildSwapBuildRequest(global);
  const swapTransactionRequest: ApiSwapCexCreateTransactionRequest = {
    ...pick(swapBuildRequest, ['from', 'fromAmount', 'to', 'swapFee', 'networkFee']),
    fromAddress: tonAddress,
    toAddress,
  };

  const swapItem = await callApi(
    'swapCexCreateTransaction',
    global.currentAccountId!,
    password,
    swapTransactionRequest,
  );

  global = getGlobal();

  if (!swapItem) {
    global = updateCurrentSwap(global, {
      isLoading: false,
      shouldResetOnClose: true,
    });
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
      void vibrateOnError();
    }
    setGlobal(global);

    actions.showError({ error: ApiCommonError.Unexpected });

    return;
  }

  global = updateCurrentSwap(global, {
    isLoading: false,
    state: shouldSendTokenToExternalWallet ? SwapState.Complete : SwapState.WaitTokens,
    activityId: swapItem.activity.id,
    payinAddress: swapItem.swap.cex!.payinAddress,
    payoutAddress: swapItem.swap.cex!.payoutAddress,
    payinExtraId: swapItem.swap.cex!.payinExtraId,
    shouldResetOnClose: true,
  });
  setGlobal(global);
  if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }

  if (shouldSendTransaction) {
    global = getGlobal();
    const transferOptions: ApiSubmitTransferOptions = {
      password,
      accountId: global.currentAccountId!,
      fee: fromDecimal(swapItem.swap.networkFee, tokenIn.decimals),
      amount: fromDecimal(swapItem.swap.fromAmount, tokenIn.decimals),
      toAddress: swapItem.swap.cex!.payinAddress,
      tokenAddress: isMutlichainAccount ? tokenIn.tokenAddress : undefined,
    };

    await pause(WAIT_FOR_CHANGELLY);

    let transferResult: ((ApiSubmitTransferResult | ApiSubmitTransferWithDieselResult) & { txId?: string }) | undefined;

    if (shouldSendTonTransaction) {
      transferResult = await callApi('submitTransfer', 'ton', transferOptions, false);
    } else if (shouldSendTronTransaction) {
      transferResult = await callApi('submitTransfer', 'tron', transferOptions, false);
    }

    if (!transferResult || 'error' in transferResult) {
      global = getGlobal();
      global = updateCurrentSwap(global, { shouldResetOnClose: true });
      if (IS_CAPACITOR) {
        global = clearIsPinAccepted(global);
      }

      setGlobal(global);
      void vibrateOnError();
      actions.showError({ error: transferResult?.error });
    }
  }
});

addActionHandler('switchSwapTokens', (global) => {
  const {
    tokenInSlug, tokenOutSlug, amountIn, amountOut, swapType,
  } = global.currentSwap;

  const newSwapType = swapType === SwapType.OnChain
    ? SwapType.OnChain
    : swapType === SwapType.CrosschainFromWallet
      ? SwapType.CrosschainToWallet
      : SwapType.CrosschainFromWallet;

  global = updateCurrentSwap(global, {
    amountIn: amountOut,
    amountOut: amountIn,
    tokenInSlug: tokenOutSlug,
    tokenOutSlug: tokenInSlug,
    inputSource: SwapInputSource.In,
    swapType: newSwapType,
    isEstimating: true,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapTokenIn', (global, actions, { tokenSlug: newTokenInSlug }) => {
  const {
    amountIn,
    amountOut,
    tokenInSlug,
    tokenOutSlug,
  } = global.currentSwap;
  const isFilled = Boolean(amountIn || amountOut);
  const newTokenIn = global.swapTokenInfo!.bySlug[newTokenInSlug];
  const adjustedAmountIn = amountIn ? roundDecimal(amountIn, newTokenIn.decimals) : amountIn;

  // Don't set the same token in both inputs
  const newTokenOutSlug = newTokenInSlug === tokenOutSlug ? tokenInSlug : tokenOutSlug;
  const newTokenOut = newTokenOutSlug ? global.swapTokenInfo!.bySlug[newTokenOutSlug] : undefined;
  const adjustedAmountOut = amountOut && newTokenOut ? roundDecimal(amountOut, newTokenOut.decimals) : amountOut;

  global = updateCurrentSwap(global, {
    amountIn: adjustedAmountIn === '0' ? undefined : adjustedAmountIn,
    amountOut: adjustedAmountOut === '0' ? undefined : adjustedAmountOut,
    tokenInSlug: newTokenInSlug,
    tokenOutSlug: newTokenOutSlug,
    isEstimating: isFilled,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapTokenOut', (global, actions, { tokenSlug: newTokenOutSlug }) => {
  const {
    amountIn,
    amountOut,
    tokenInSlug,
    tokenOutSlug,
  } = global.currentSwap;
  const isFilled = Boolean(amountIn || amountOut);
  const newTokenOut = global.swapTokenInfo!.bySlug[newTokenOutSlug!];
  const adjustedAmountOut = amountOut ? roundDecimal(amountOut, newTokenOut.decimals) : amountOut;

  // Don't set the same token in both inputs
  const newTokenInSlug = newTokenOutSlug === tokenInSlug ? tokenOutSlug : tokenInSlug;
  const newTokenIn = newTokenInSlug ? global.swapTokenInfo!.bySlug[newTokenInSlug] : undefined;
  const adjustedAmountIn = amountIn && newTokenIn ? roundDecimal(amountIn, newTokenIn.decimals) : amountIn;

  global = updateCurrentSwap(global, {
    amountOut: adjustedAmountOut === '0' ? undefined : adjustedAmountOut,
    amountIn: adjustedAmountIn === '0' ? undefined : adjustedAmountIn,
    tokenOutSlug: newTokenOutSlug,
    tokenInSlug: newTokenInSlug,
    isEstimating: isFilled,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapAmountIn', (global, actions, { amount }) => {
  const isEstimating = Boolean(amount && getIsPositiveDecimal(amount));

  global = updateCurrentSwap(global, {
    amountIn: amount,
    inputSource: SwapInputSource.In,
    isEstimating,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapAmountOut', (global, actions, { amount }) => {
  const isEstimating = Boolean(amount && getIsPositiveDecimal(amount));

  global = updateCurrentSwap(global, {
    amountOut: amount,
    inputSource: SwapInputSource.Out,
    isEstimating,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSlippage', (global, actions, { slippage }) => {
  global = updateCurrentSwap(global, {
    slippage,
    isEstimating: true,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('estimateSwap', async (global, actions, { shouldBlock, isEnoughToncoin }) => {
  if (isEstimateSwapBeingExecuted) return;

  isEstimateSwapBeingExecuted = true;
  const resetParams = {
    amountOutMin: '0',
    transactionFee: '0',
    swapFee: '0',
    networkFee: 0,
    realNetworkFee: 0,
    priceImpact: 0,
    errorType: undefined,
    isEstimating: false,
  };

  global = updateCurrentSwap(global, {
    shouldEstimate: false,
  });

  // Check for empty string
  if ((global.currentSwap.amountIn === undefined && global.currentSwap.inputSource === SwapInputSource.In)
      || (global.currentSwap.amountOut === undefined && global.currentSwap.inputSource === SwapInputSource.Out)) {
    global = updateCurrentSwap(global, {
      amountIn: undefined,
      amountOut: undefined,
      ...resetParams,
    });
    setGlobal(global);
    isEstimateSwapBeingExecuted = false;
    return;
  }

  const pairsBySlug = global.currentSwap.pairs?.bySlug ?? {};
  const canSwap = global.currentSwap.tokenOutSlug! in pairsBySlug;

  // Check for invalid pair
  if (!canSwap) {
    const amount = global.currentSwap.inputSource === SwapInputSource.In
      ? { amountOut: undefined }
      : { amountIn: undefined };

    global = updateCurrentSwap(global, {
      ...amount,
      ...resetParams,
      errorType: SwapErrorType.InvalidPair,
    });
    setGlobal(global);
    isEstimateSwapBeingExecuted = false;
    return;
  }

  global = updateCurrentSwap(global, {
    isEstimating: shouldBlock,
  });
  setGlobal(global);

  const tokenIn = global.swapTokenInfo!.bySlug[global.currentSwap.tokenInSlug!];
  const tokenOut = global.swapTokenInfo!.bySlug[global.currentSwap.tokenOutSlug!];

  const from = tokenIn.slug === TONCOIN.slug ? tokenIn.symbol : tokenIn.tokenAddress!;
  const to = tokenOut.slug === TONCOIN.slug ? tokenOut.symbol : tokenOut.tokenAddress!;
  const fromAmount = global.currentSwap.amountIn ?? '0';
  const toAmount = global.currentSwap.amountOut ?? '0';
  const fromAddress = selectCurrentAccount(global)!.addressByChain.ton;

  const estimateAmount = global.currentSwap.inputSource === SwapInputSource.In ? { fromAmount } : { toAmount };

  const shouldTryDiesel = isEnoughToncoin === false;

  const estimate = await callApi('swapEstimate', {
    ...estimateAmount,
    from,
    to,
    slippage: global.currentSwap.slippage,
    fromAddress,
    shouldTryDiesel,
  });

  isEstimateSwapBeingExecuted = false;
  global = getGlobal();

  if (!estimate || 'error' in estimate) {
    const errorType = estimate?.error && estimate?.error in SERVER_ERRORS_MAP
      ? SERVER_ERRORS_MAP[estimate.error as keyof typeof SERVER_ERRORS_MAP]
      : SwapErrorType.UnexpectedError;

    global = updateCurrentSwap(global, {
      ...resetParams,
      errorType,
    });
    setGlobal(global);
    return;
  }

  // Check for outdated response
  if (
    (global.currentSwap.inputSource === SwapInputSource.In
        && global.currentSwap.amountIn !== estimate.fromAmount)
    || (global.currentSwap.inputSource === SwapInputSource.Out
        && global.currentSwap.amountOut !== estimate.toAmount)
  ) {
    global = updateCurrentSwap(global, {
      ...resetParams,
    });
    setGlobal(global);
    return;
  }

  const errorType = estimate.toAmount === '0' && shouldTryDiesel
    ? SwapErrorType.NotEnoughForFee
    : undefined;

  // `networkFee` here does not directly include transfer fee
  const maxTransferFee = Number(toDecimal(getChainConfig('ton').gas.maxTransfer));
  const networkFee = estimate.networkFee + maxTransferFee;

  global = updateCurrentSwap(global, {
    ...(
      global.currentSwap.inputSource === SwapInputSource.In
        ? { amountOut: estimate.toAmount }
        : { amountIn: estimate.fromAmount }
    ),
    amountOutMin: estimate.toMinAmount,
    swapFee: estimate.swapFee,
    priceImpact: estimate.impact,
    dexLabel: estimate.dexLabel,
    feeSource: SwapFeeSource.In,
    isEstimating: false,
    errorType,
    dieselStatus: estimate.dieselStatus,
    networkFee,
    realNetworkFee: estimate.realNetworkFee,
  });
  setGlobal(global);
});

addActionHandler('estimateSwapCex', async (global, actions, { shouldBlock }) => {
  if (isEstimateCexSwapBeingExecuted) return;

  isEstimateCexSwapBeingExecuted = true;
  const amount = global.currentSwap.inputSource === SwapInputSource.In
    ? { amountOut: undefined }
    : { amountIn: undefined };

  const resetParams = {
    ...amount,
    amountOutMin: '0',
    transactionFee: '0',
    swapFee: '0',
    networkFee: 0,
    realNetworkFee: 0,
    priceImpact: 0,
    errorType: undefined,
    isEstimating: false,
  };

  const resetSwapFeeParams = {
    shouldEstimate: false,
    transactionFee: '0',
    swapFee: '0',
    networkFee: 0,
    priceImpact: 0,
  };

  // Check for empty string
  const { amountIn, amountOut, inputSource } = global.currentSwap;
  if (((amountIn === undefined || amountIn === '0') && inputSource === SwapInputSource.In)
      || ((amountOut === undefined || amountOut === '0') && global.currentSwap.inputSource === SwapInputSource.Out)) {
    global = updateCurrentSwap(global, {
      amountIn: undefined,
      amountOut: undefined,
      ...resetSwapFeeParams,
      ...resetParams,
    });
    setGlobal(global);
    isEstimateCexSwapBeingExecuted = false;
    return;
  }

  const pairsBySlug = global.currentSwap.pairs?.bySlug ?? {};
  const canSwap = global.currentSwap.tokenOutSlug! in pairsBySlug;

  // Check for invalid pair
  if (!canSwap) {
    global = updateCurrentSwap(global, {
      ...resetParams,
      ...resetSwapFeeParams,
      errorType: SwapErrorType.InvalidPair,
    });
    setGlobal(global);
    return;
  }

  global = updateCurrentSwap(global, {
    isEstimating: shouldBlock,
  });
  setGlobal(global);

  const tokenIn = global.swapTokenInfo!.bySlug[global.currentSwap.tokenInSlug!];
  const tokenOut = global.swapTokenInfo!.bySlug[global.currentSwap.tokenOutSlug!];

  const from = resolveSwapAssetId(tokenIn);
  const to = resolveSwapAssetId(tokenOut);
  const fromAmount = global.currentSwap.amountIn ?? '0';

  const estimate = await callApi('swapCexEstimate', {
    fromAmount,
    from,
    to,
  });

  global = getGlobal();
  isEstimateCexSwapBeingExecuted = false;

  if (!estimate || 'errors' in estimate) {
    global = updateCurrentSwap(global, {
      ...resetParams,
      ...resetSwapFeeParams,
      errorType: window.navigator.onLine ? SwapErrorType.InvalidPair : SwapErrorType.UnexpectedError,
    });
    setGlobal(global);
    return;
  }

  if ('errors' in estimate) {
    global = updateCurrentSwap(global, {
      ...resetParams,
      ...resetSwapFeeParams,
      errorType: SwapErrorType.UnexpectedError,
    });
    setGlobal(global);
    return;
  }

  if ('error' in estimate) {
    const { error } = estimate as { error: string };
    if (error.includes('requests limit')) return;

    if (error.includes('Invalid amount')) {
      const [, mode, matchedAmount] = error.match(/(Maximum|Minimal) amount is ([\d.]+) .*/) || [];
      if (mode && matchedAmount) {
        const isLessThanMin = mode === 'Minimal';
        global = updateCurrentSwap(global, {
          ...resetParams,
          ...resetSwapFeeParams,
          limits: isLessThanMin ? { fromMin: matchedAmount } : { fromMax: matchedAmount },
          errorType: isLessThanMin ? SwapErrorType.ChangellyMinSwap : SwapErrorType.ChangellyMaxSwap,
        });
        setGlobal(global);
        return;
      }
    }

    global = updateCurrentSwap(global, {
      ...resetParams,
      ...resetSwapFeeParams,
      errorType: SwapErrorType.UnexpectedError,
    });
    setGlobal(global);
    return;
  }

  const isLessThanMin = Big(fromAmount).lt(estimate.fromMin);
  const isBiggerThanMax = Big(fromAmount).gt(estimate.fromMax);

  if (isLessThanMin || isBiggerThanMax) {
    global = updateCurrentSwap(global, {
      ...resetParams,
      ...resetSwapFeeParams,
      limits: {
        fromMin: estimate.fromMin,
        fromMax: estimate.fromMax,
      },
      errorType: isLessThanMin ? SwapErrorType.ChangellyMinSwap : SwapErrorType.ChangellyMaxSwap,
    });
    setGlobal(global);
    return;
  }

  // Check for outdated response
  if (
    (global.currentSwap.inputSource === SwapInputSource.In
          && global.currentSwap.amountIn !== estimate.fromAmount)
      || (global.currentSwap.inputSource === SwapInputSource.Out
          && global.currentSwap.amountOut !== estimate.toAmount)
  ) {
    global = updateCurrentSwap(global, {
      ...resetParams,
      ...resetSwapFeeParams,
    });
    setGlobal(global);
    return;
  }

  let networkFee = 0;
  const account = global.accounts?.byId[global.currentAccountId!];

  if (global.currentSwap.swapType === SwapType.CrosschainFromWallet) {
    if (tokenIn.chain === 'ton') {
      const txDraft = await callApi('checkTransactionDraft', 'ton', {
        accountId: global.currentAccountId!,
        toAddress: account?.addressByChain.ton!,
        tokenAddress: tokenIn.tokenAddress,
        amount: fromDecimal(global.currentSwap.amountIn ?? 0, tokenIn.decimals),
      });
      networkFee = Number(toDecimal(txDraft?.fee ?? 0n, TONCOIN.decimals));
    } else if (tokenIn.chain === 'tron') {
      const txDraft = await callApi('checkTransactionDraft', 'tron', {
        accountId: global.currentAccountId!,
        toAddress: TRX_SWAP_COUNT_FEE_ADDRESS,
        tokenAddress: tokenIn.tokenAddress,
        amount: fromDecimal(global.currentSwap.amountIn ?? 0, tokenIn.decimals),
      });
      networkFee = Number(toDecimal(txDraft?.fee ?? 0n, TRX.decimals));
    }
  }

  global = getGlobal();

  global = updateCurrentSwap(global, {
    ...resetSwapFeeParams,
    amountOut: estimate.toAmount === '0' ? undefined : estimate.toAmount,
    limits: {
      fromMin: estimate.fromMin,
      fromMax: estimate.fromMax,
    },
    swapFee: estimate.swapFee,
    networkFee,
    realNetworkFee: networkFee,
    amountOutMin: estimate.toAmount,
    isEstimating: false,
    errorType: undefined,
  });
  setGlobal(global);
});

addActionHandler('setSwapScreen', (global, actions, { state }) => {
  if (state === SwapState.Initial) {
    global = updateCurrentSwap(global, { swapId: generateUniqueId() });
  }
  global = updateCurrentSwap(global, { state });
  setGlobal(global);
});

addActionHandler('clearSwapError', (global) => {
  global = updateCurrentSwap(global, { error: undefined });
  setGlobal(global);
});

addActionHandler('setSwapType', (global, actions, { type }) => {
  global = updateCurrentSwap(global, { swapType: type });
  setGlobal(global);
});

addActionHandler('loadSwapPairs', async (global, actions, { tokenSlug, shouldForceUpdate }) => {
  const tokenIn = global.swapTokenInfo?.bySlug[tokenSlug];
  if (!tokenIn) {
    return;
  }

  const assetId = resolveSwapAssetId(tokenIn);

  const cache = pairsCache[tokenSlug];
  const isCacheValid = cache && (Date.now() - cache.timestamp <= CACHE_DURATION);
  if (isCacheValid && !shouldForceUpdate) {
    return;
  }

  const pairs = await callApi('swapGetPairs', assetId);
  global = getGlobal();

  if (!pairs) {
    global = updateCurrentSwap(global, {
      pairs: {
        bySlug: {
          ...global.currentSwap.pairs?.bySlug,
          [tokenSlug]: {},
        },
      },
    });
    setGlobal(global);
    return;
  }

  const isTonTokenIn = tokenIn.chain === 'ton';

  const bySlug = pairs.reduce((acc, pair) => {
    const isTonTokenOut = getIsTonToken(pair.slug, true);
    const countTonTokens = Number(isTonTokenIn) + (isTonTokenOut ? 1 : 0);

    const isMultichain = !(
      (countTonTokens === 2) || (countTonTokens === 1 && [tokenIn.slug, pair.slug].includes(TONCOIN.slug))
    );

    acc[pair.slug] = {
      ...(isMultichain && {
        isMultichain,
      }),
      ...(pair.isReverseProhibited && {
        isReverseProhibited: pair.isReverseProhibited,
      }),
    };
    return acc;
  }, {} as AssetPairs);

  pairsCache[tokenSlug] = { data: pairs, timestamp: Date.now() };

  global = updateCurrentSwap(global, {
    pairs: {
      bySlug: {
        ...global.currentSwap.pairs?.bySlug,
        [tokenSlug]: bySlug,
      },
    },
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapCexAddress', (global, actions, { toAddress }) => {
  global = updateCurrentSwap(global, { toAddress });
  setGlobal(global);
});

addActionHandler('clearSwapPairsCache', () => {
  pairsCache = {};
});

addActionHandler('updatePendingSwaps', async (global) => {
  const accountId = global.currentAccountId;
  if (!accountId) return;

  let { activities } = selectAccountState(global, accountId) ?? {};
  if (!activities) return;

  const ids = Object.values(activities.byId)
    .filter((activity) => activity.kind === 'swap' && activity.status === 'pending')
    .map(({ id }) => id);
  if (!ids.length) return;

  const swaps = await callApi('fetchSwaps', accountId, ids);
  if (!swaps?.length) return;

  global = getGlobal();
  if (global.currentAccountId !== accountId) return;

  ({ activities } = selectAccountState(global, accountId) ?? {});

  global = updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: {
        ...activities?.byId,
        ...buildCollectionByKey(swaps, 'id'),
      },
    },
  });

  setGlobal(global);
});
