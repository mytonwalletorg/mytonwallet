import type {
  AssetPairs,
  GlobalState,
} from '../../types';
import {
  ApiCommonError,
  type ApiSwapBuildRequest,
  type ApiSwapHistoryItem,
  type ApiSwapPairAsset,
} from '../../../api/types';
import {
  ActiveTab,
  SwapErrorType,
  SwapFeeSource,
  SwapInputSource,
  SwapState,
  SwapType,
} from '../../types';

import {
  DEFAULT_FEE, DEFAULT_SWAP_SECOND_TOKEN_SLUG, IS_CAPACITOR, TONCOIN_SLUG,
} from '../../../config';
import { Big } from '../../../lib/big.js';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/capacitor';
import {
  fromDecimal, getIsPositiveDecimal, roundDecimal, toDecimal,
} from '../../../util/decimals';
import generateUniqueId from '../../../util/generateUniqueId';
import { buildCollectionByKey, pick } from '../../../util/iteratees';
import { callActionInMain, callActionInNative } from '../../../util/multitab';
import { pause } from '../../../util/schedulers';
import { buildSwapId } from '../../../util/swap/buildSwapId';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../..';
import {
  clearCurrentSwap,
  clearIsPinAccepted,
  setIsPinAccepted,
  updateAccountState,
  updateCurrentSwap,
} from '../../reducers';
import {
  selectAccount, selectAccountState, selectCurrentAccount, selectCurrentToncoinBalance,
} from '../../selectors';

import { getIsPortrait } from '../../../hooks/useDeviceScreen';

const PAIRS_CACHE: Record<string, { data: ApiSwapPairAsset[]; timestamp: number }> = {};

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const WAIT_FOR_CHANGELLY = 5 * 1000;
const CLOSING_BOTTOM_SHEET_DURATION = 100; // Like in `useDelegatingBottomSheet`
let isEstimateSwapBeingExecuted = false;
let isEstimateCexSwapBeingExecuted = false;

const SERVER_ERRORS_MAP = {
  'Insufficient liquidity': SwapErrorType.NotEnoughLiquidity,
  'Tokens must be different': SwapErrorType.InvalidPair,
  'Asset not found': SwapErrorType.InvalidPair,
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
  const from = tokenIn.slug === TONCOIN_SLUG ? tokenIn.symbol : tokenIn.contract!;
  const to = tokenOut.slug === TONCOIN_SLUG ? tokenOut.symbol : tokenOut.contract!;
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
    fromAddress: account?.address!,
    dexLabel: dexLabel!,
    networkFee: networkFee!,
    swapFee: swapFee!,
    shouldTryDiesel,
  };
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

    const isCrosschain = tokenIn?.blockchain !== 'ton' || tokenOut?.blockchain !== 'ton';
    const isToTon = tokenOut?.blockchain === 'ton';

    const swapType = isCrosschain
      ? (isToTon ? SwapType.CrosschainToToncoin : SwapType.CrosschainFromToncoin)
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
  const { tokenInSlug: requiredTokenInSlug, tokenOutSlug: requiredTokenOutSlug } = payload ?? {};

  global = updateCurrentSwap(global, {
    tokenInSlug: requiredTokenInSlug ?? TONCOIN_SLUG,
    tokenOutSlug: requiredTokenOutSlug ?? DEFAULT_SWAP_SECOND_TOKEN_SLUG,
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
      transactionFee: '0',
      swapFee: '0',
      networkFee: 0,
      realNetworkFee: 0,
      amountOutMin: '0',
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
  const currentSwapId = global.currentSwap.swapId;
  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }
  global = updateCurrentSwap(global, {
    isLoading: true,
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

  if (!buildResult || 'error' in buildResult) {
    actions.showError({ error: buildResult?.error });
    global = getGlobal();
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
      void vibrateOnError();
    }
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    setGlobal(global);
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

  const result = await callApi(
    'swapSubmit',
    global.currentAccountId!,
    password,
    buildResult.transfers,
    swapHistoryItem,
    swapBuildRequest.shouldTryDiesel,
  );

  global = getGlobal();

  if (!result || 'error' in result) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
      void vibrateOnError();
    }
    setGlobal(global);
    actions.showError({ error: result?.error });
    return;
  }

  if (currentSwapId !== global.currentSwap.swapId) {
    setGlobal(global);
    return;
  }

  global = updateCurrentSwap(global, {
    tokenInSlug: undefined,
    tokenOutSlug: undefined,
    amountIn: undefined,
    amountOut: undefined,
    isLoading: false,
    state: SwapState.Complete,
    activityId: buildSwapId(buildResult.id),
  });
  setGlobal(global);
  if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }
});

addActionHandler('submitSwapCexFromToncoin', async (global, actions, { password }) => {
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
    error: undefined,
  });
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  const swapBuildRequest = buildSwapBuildRequest(global);
  const swapItem = await callApi(
    'swapCexCreateTransaction',
    global.currentAccountId!,
    password,
    {
      ...pick(swapBuildRequest, ['from', 'fromAmount', 'fromAddress', 'to', 'swapFee', 'networkFee']),
      toAddress: global.currentSwap.toAddress!,
    },
  );

  if (!swapItem) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
      void vibrateOnError();
    }
    setGlobal(global);
    actions.showError({ error: ApiCommonError.Unexpected });
    return;
  }

  global = getGlobal();

  const asset = global.swapTokenInfo.bySlug[global.currentSwap.tokenInSlug!];

  const transferOptions = {
    password,
    accountId: global.currentAccountId!,
    slug: global.currentSwap.tokenInSlug!,
    fee: fromDecimal(swapItem.swap.swapFee, asset.decimals), // TODO
    ...swapItem.transfer!,
  };

  await pause(WAIT_FOR_CHANGELLY);

  const result = await callApi('submitTransfer', transferOptions, false);

  global = getGlobal();

  if (!result || 'error' in result) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
      void vibrateOnError();
    }
    setGlobal(global);
    actions.showError({ error: result?.error });
    return;
  }

  global = getGlobal();
  global = updateCurrentSwap(global, {
    tokenInSlug: undefined,
    tokenOutSlug: undefined,
    amountIn: undefined,
    amountOut: undefined,
    isLoading: false,
    state: SwapState.Complete,
    activityId: swapItem.activity.id,
  });
  setGlobal(global);
  if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }
});

addActionHandler('submitSwapCexToToncoin', async (global, actions, { password }) => {
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
  });
  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
    global = getGlobal();
  }

  const swapBuildRequest = buildSwapBuildRequest(global);
  const swapItem = await callApi(
    'swapCexCreateTransaction',
    global.currentAccountId!,
    password,
    {
      ...pick(swapBuildRequest, ['from', 'fromAmount', 'fromAddress', 'to', 'swapFee', 'networkFee']),
      toAddress: swapBuildRequest.fromAddress,
    },
  );

  global = getGlobal();

  if (!swapItem) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
      void vibrateOnError();
    }
    setGlobal(global);
    actions.showError({ error: ApiCommonError.Unexpected });
    return;
  }

  global = getGlobal();
  global = updateCurrentSwap(global, {
    isLoading: false,
    state: SwapState.WaitTokens,
    payinAddress: swapItem.swap.cex!.payinAddress,
    payinExtraId: swapItem.swap.cex!.payinExtraId,
    activityId: swapItem.activity.id,
  });
  setGlobal(global);
  if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }
});

addActionHandler('switchSwapTokens', (global) => {
  const {
    tokenInSlug, tokenOutSlug, amountIn, amountOut, swapType,
  } = global.currentSwap;

  const newSwapType = swapType === SwapType.OnChain
    ? SwapType.OnChain
    : swapType === SwapType.CrosschainFromToncoin
      ? SwapType.CrosschainToToncoin
      : SwapType.CrosschainFromToncoin;

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

addActionHandler('setSwapTokenIn', (global, actions, { tokenSlug }) => {
  const { amountIn, amountOut } = global.currentSwap;
  const isFilled = Boolean(amountIn || amountOut);
  const newTokenIn = global.swapTokenInfo!.bySlug[tokenSlug!];
  const amount = amountIn ? roundDecimal(amountIn, newTokenIn.decimals) : amountIn;

  global = updateCurrentSwap(global, {
    amountIn: amount === '0' ? undefined : amount,
    tokenInSlug: tokenSlug,
    isEstimating: isFilled,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapTokenOut', (global, actions, { tokenSlug }) => {
  const { amountIn, amountOut } = global.currentSwap;
  const isFilled = Boolean(amountIn || amountOut);
  const newTokenOut = global.swapTokenInfo!.bySlug[tokenSlug!];
  const amount = amountOut ? roundDecimal(amountOut, newTokenOut.decimals) : amountOut;

  global = updateCurrentSwap(global, {
    amountOut: amount === '0' ? undefined : amount,
    tokenOutSlug: tokenSlug,
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

  const from = tokenIn.slug === TONCOIN_SLUG ? tokenIn.symbol : tokenIn.contract!;
  const to = tokenOut.slug === TONCOIN_SLUG ? tokenOut.symbol : tokenOut.contract!;
  const fromAmount = global.currentSwap.amountIn ?? '0';
  const toAmount = global.currentSwap.amountOut ?? '0';
  const fromAddress = selectCurrentAccount(global)!.address;

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
    networkFee: estimate.networkFee,
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

  global = updateCurrentSwap(global, {
    shouldEstimate: false,
    transactionFee: '0',
    swapFee: '0',
    networkFee: 0,
    priceImpact: 0,
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
    isEstimateCexSwapBeingExecuted = false;
    return;
  }

  const pairsBySlug = global.currentSwap.pairs?.bySlug ?? {};
  const canSwap = global.currentSwap.tokenOutSlug! in pairsBySlug;

  // Check for invalid pair
  if (!canSwap) {
    global = updateCurrentSwap(global, {
      ...resetParams,
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

  const from = tokenIn.slug === TONCOIN_SLUG ? tokenIn.symbol : tokenIn.contract!;
  const to = tokenOut.slug === TONCOIN_SLUG ? tokenOut.symbol : tokenOut.contract!;
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
      errorType: window.navigator.onLine ? SwapErrorType.InvalidPair : SwapErrorType.UnexpectedError,
    });
    setGlobal(global);
    return;
  }

  if ('errors' in estimate) {
    global = updateCurrentSwap(global, { ...resetParams, errorType: SwapErrorType.UnexpectedError });
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
          limits: isLessThanMin ? { fromMin: matchedAmount } : { fromMax: matchedAmount },
          errorType: isLessThanMin ? SwapErrorType.ChangellyMinSwap : SwapErrorType.ChangellyMaxSwap,
        });
        setGlobal(global);
        return;
      }
    }

    global = updateCurrentSwap(global, {
      ...resetParams,
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
    });
    setGlobal(global);
    return;
  }

  let networkFee = 0;

  if (global.currentSwap.swapType === SwapType.CrosschainFromToncoin) {
    const account = global.accounts?.byId[global.currentAccountId!];

    const txDraft = await callApi('checkTransactionDraft', {
      accountId: global.currentAccountId!,
      toAddress: account?.address!,
      amount: fromDecimal(global.currentSwap.amountIn ?? 0, tokenIn.decimals),
    });
    networkFee = Number(toDecimal(txDraft?.fee ?? 0n));
  }

  global = getGlobal();

  global = updateCurrentSwap(global, {
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

  const symbolOrMinter = tokenIn.slug === TONCOIN_SLUG ? tokenIn.symbol : tokenIn.contract!;

  const cache = PAIRS_CACHE[tokenSlug];
  const isCacheValid = cache && (Date.now() - cache.timestamp <= CACHE_DURATION);
  if (isCacheValid && !shouldForceUpdate) {
    return;
  }

  const pairs = await callApi('swapGetPairs', symbolOrMinter);
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

  const bySlug = pairs.reduce((acc, pair) => {
    acc[pair.slug] = pair.isReverseProhibited ? {
      isReverseProhibited: pair.isReverseProhibited,
    } : {};
    return acc;
  }, {} as AssetPairs);

  PAIRS_CACHE[tokenSlug] = { data: pairs, timestamp: Date.now() };

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
