import type { AssetPairs, GlobalState } from '../../types';
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

import { IS_CAPACITOR, JWBTC_TOKEN_SLUG, TON_TOKEN_SLUG } from '../../../config';
import { Big } from '../../../lib/big.js';
import { vibrateOnSuccess } from '../../../util/capacitor';
import safeNumberToString from '../../../util/safeNumberToString';
import { pause } from '../../../util/schedulers';
import shiftDecimals from '../../../util/shiftDecimals';
import { buildSwapId } from '../../../util/swap/buildSwapId';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../..';
import { bigStrToHuman, humanToBigStr } from '../../helpers';
import {
  clearCurrentSwap,
  clearIsPinAccepted,
  setIsPinAccepted,
  updateCurrentSwap,
} from '../../reducers';
import { selectAccount } from '../../selectors';

import { callActionInMain } from '../../../hooks/useDelegatedBottomSheet';

const PAIRS_CACHE: Record<string, { data: ApiSwapPairAsset[]; timestamp: number }> = {};

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const WAIT_FOR_CHANGELLY = 5 * 1000;

function getSwapBuildOptions(global: GlobalState): ApiSwapBuildRequest {
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
  const from = tokenIn.slug === TON_TOKEN_SLUG ? tokenIn.symbol : tokenIn.contract!;
  const to = tokenOut.slug === TON_TOKEN_SLUG ? tokenOut.symbol : tokenOut.contract!;
  const fromAmount = safeNumberToString(amountIn!, tokenIn.decimals);
  const toAmount = safeNumberToString(amountOut!, tokenOut.decimals);
  const account = selectAccount(global, global.currentAccountId!);

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
  };
}

addActionHandler('startSwap', (global, actions, payload) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('startSwap', payload);
    return;
  }

  const { isPortrait, ...rest } = payload ?? {};
  const { tokenInSlug, tokenOutSlug, amountIn } = rest;

  if (tokenInSlug || tokenOutSlug || amountIn) {
    const tokenIn = global.swapTokenInfo?.bySlug[tokenInSlug!];
    const tokenOut = global.swapTokenInfo?.bySlug[tokenOutSlug!];

    const isCrosschain = tokenIn?.blockchain !== 'ton' || tokenOut?.blockchain !== 'ton';
    const isToTon = tokenOut?.blockchain === 'ton';

    const swapType = isCrosschain
      ? (isToTon ? SwapType.CrosschainToTon : SwapType.CrosschainFromTon)
      : SwapType.OnChain;

    global = updateCurrentSwap(global, {
      ...rest,
      isEstimating: true,
      shouldEstimate: true,
      inputSource: SwapInputSource.In,
      swapType,
    });
  }

  global = updateCurrentSwap(global, {
    state: isPortrait ? SwapState.Initial : SwapState.None,
  });
  setGlobal(global);

  if (!isPortrait) {
    actions.setLandscapeActionsActiveTabIndex({ index: ActiveTab.Swap });
  }
});

addActionHandler('setDefaultSwapParams', (global, actions, payload) => {
  const { tokenInSlug: requiredTokenInSlug, tokenOutSlug: requiredTokenOutSlug } = payload ?? {};

  global = updateCurrentSwap(global, {
    tokenInSlug: requiredTokenInSlug ?? TON_TOKEN_SLUG,
    tokenOutSlug: requiredTokenOutSlug ?? JWBTC_TOKEN_SLUG,
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
    error: undefined,
  });
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  const options = getSwapBuildOptions(global);
  const buildResult = await callApi('swapBuildTransfer', global.currentAccountId!, password, options);

  if (!buildResult || 'error' in buildResult) {
    actions.showError({ error: buildResult?.error });
    global = getGlobal();
    if (IS_CAPACITOR) {
      global = clearIsPinAccepted(global);
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
    from: options.from,
    fromAmount: options.fromAmount,
    to: options.to,
    toAmount: options.toAmount,
    networkFee: global.currentSwap.networkFee!,
    swapFee: global.currentSwap.swapFee!,
  };

  const result = await callApi(
    'swapSubmit',
    global.currentAccountId!,
    password,
    buildResult.fee,
    buildResult.transfers,
    swapHistoryItem,
  );

  global = getGlobal();

  if (!result || 'error' in result) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    setGlobal(global);
    actions.showError({ error: result?.error });
    return;
  }

  global = updateCurrentSwap(global, {
    isLoading: false,
    state: SwapState.Complete,
    activityId: buildSwapId(buildResult.id),
  });
  setGlobal(global);
});

addActionHandler('submitSwapCexFromTon', async (global, actions, { password }) => {
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
  const swapOptions = getSwapBuildOptions(global);
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  const swapItem = await callApi(
    'swapCexCreateTransaction',
    global.currentAccountId!,
    password,
    {
      from: swapOptions.from,
      fromAmount: swapOptions.fromAmount,
      fromAddress: swapOptions.fromAddress,
      to: swapOptions.to,
      toAddress: global.currentSwap.toAddress!,
      swapFee: swapOptions.swapFee,
      networkFee: swapOptions.networkFee,
    },
  );

  if (!swapItem) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
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
    toAddress: swapItem.swap.cex!.payinAddress,
    amount: humanToBigStr(Number(swapItem.swap.fromAmount), asset.decimals),
    fee: swapItem.swap.swapFee,
  };

  await pause(WAIT_FOR_CHANGELLY);

  const result = await callApi('submitTransfer', transferOptions, false);

  global = getGlobal();

  if (!result || 'error' in result) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    setGlobal(global);
    actions.showError({ error: result?.error });
    return;
  }

  global = getGlobal();
  global = updateCurrentSwap(global, {
    isLoading: false,
    state: SwapState.Complete,
    activityId: swapItem.activity.id,
  });
  setGlobal(global);
});

addActionHandler('submitSwapCexToTon', async (global, actions, { password }) => {
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
  setGlobal(global);

  const swapOptions = getSwapBuildOptions(global);
  const swapItem = await callApi(
    'swapCexCreateTransaction',
    global.currentAccountId!,
    password,
    {
      from: swapOptions.from,
      fromAmount: swapOptions.fromAmount,
      fromAddress: swapOptions.fromAddress,
      to: swapOptions.to,
      toAddress: swapOptions.fromAddress,
      swapFee: swapOptions.swapFee,
      networkFee: swapOptions.networkFee,
    },
  );

  global = getGlobal();

  if (!swapItem) {
    global = updateCurrentSwap(global, {
      isLoading: false,
    });
    setGlobal(global);
    actions.showError({ error: ApiCommonError.Unexpected });
    return;
  }

  global = getGlobal();
  global = updateCurrentSwap(global, {
    isLoading: false,
    state: SwapState.WaitTokens,
    payinAddress: swapItem.swap.cex!.payinAddress,
    activityId: swapItem.activity.id,
  });
  setGlobal(global);
});

addActionHandler('switchSwapTokens', (global) => {
  const {
    tokenInSlug, tokenOutSlug, amountIn, amountOut, swapType,
  } = global.currentSwap;

  const newSwapType = swapType === SwapType.OnChain
    ? SwapType.OnChain
    : swapType === SwapType.CrosschainFromTon
      ? SwapType.CrosschainToTon
      : SwapType.CrosschainFromTon;

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
  const { tokenInSlug, amountIn, amountOut } = global.currentSwap;
  const isFilled = Boolean(amountIn || amountOut);
  const oldTokenIn = global.swapTokenInfo!.bySlug[tokenInSlug!];
  const newTokenIn = global.swapTokenInfo!.bySlug[tokenSlug!];
  const amount = amountIn
    ? shiftDecimals(amountIn ?? 0, oldTokenIn.decimals, newTokenIn.decimals)
    : amountIn;

  global = updateCurrentSwap(global, {
    amountIn: amount === 0 ? undefined : amount,
    tokenInSlug: tokenSlug,
    isEstimating: isFilled,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapTokenOut', (global, actions, { tokenSlug }) => {
  const { tokenOutSlug, amountIn, amountOut } = global.currentSwap;
  const isFilled = Boolean(amountIn || amountOut);
  const oldTokenOut = global.swapTokenInfo!.bySlug[tokenOutSlug!];
  const newTokenOut = global.swapTokenInfo!.bySlug[tokenSlug!];
  const amount = amountOut
    ? shiftDecimals(amountOut ?? 0, oldTokenOut.decimals, newTokenOut.decimals)
    : amountOut;

  global = updateCurrentSwap(global, {
    amountOut: amount === 0 ? undefined : amount,
    tokenOutSlug: tokenSlug,
    isEstimating: isFilled,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapAmountIn', (global, actions, { amount }) => {
  const isEstimating = Boolean(amount && amount > 0);

  global = updateCurrentSwap(global, {
    amountIn: amount,
    inputSource: SwapInputSource.In,
    isEstimating,
    shouldEstimate: true,
  });
  setGlobal(global);
});

addActionHandler('setSwapAmountOut', (global, actions, { amount }) => {
  const isEstimating = Boolean(amount && amount > 0);

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

addActionHandler('estimateSwap', async (global, actions, { shouldBlock }) => {
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
    return;
  }

  global = updateCurrentSwap(global, {
    isEstimating: shouldBlock,
  });
  setGlobal(global);

  const tokenIn = global.swapTokenInfo!.bySlug[global.currentSwap.tokenInSlug!];
  const tokenOut = global.swapTokenInfo!.bySlug[global.currentSwap.tokenOutSlug!];

  const from = tokenIn.slug === TON_TOKEN_SLUG ? tokenIn.symbol : tokenIn.contract!;
  const to = tokenOut.slug === TON_TOKEN_SLUG ? tokenOut.symbol : tokenOut.contract!;
  const fromAmount = safeNumberToString(global.currentSwap.amountIn ?? 0, tokenIn.decimals);
  const toAmount = safeNumberToString(global.currentSwap.amountOut ?? 0, tokenOut.decimals);

  const estimateAmount = global.currentSwap.inputSource === SwapInputSource.In ? { fromAmount } : { toAmount };

  const estimate = await callApi('swapEstimate', {
    ...estimateAmount,
    from,
    to,
    slippage: global.currentSwap.slippage,
  });

  global = getGlobal();

  if (!estimate || 'error' in estimate) {
    if (estimate?.error === 'Insufficient liquidity') {
      global = updateCurrentSwap(global, {
        ...resetParams,
        errorType: SwapErrorType.NotEnoughLiquidity,
      });
      setGlobal(global);
      return;
    }

    global = updateCurrentSwap(global, {
      ...resetParams,
      errorType: SwapErrorType.InvalidPair,
    });
    setGlobal(global);
    return;
  }

  // Check for outdated response
  if (
    (global.currentSwap.inputSource === SwapInputSource.In
        && global.currentSwap.amountIn !== Number(estimate.fromAmount))
    || (global.currentSwap.inputSource === SwapInputSource.Out
        && global.currentSwap.amountOut !== Number(estimate.toAmount))
  ) {
    global = updateCurrentSwap(global, {
      ...resetParams,
    });
    setGlobal(global);
    return;
  }

  global = updateCurrentSwap(global, {
    ...(
      global.currentSwap.inputSource === SwapInputSource.In
        ? { amountOut: Number(estimate.toAmount) }
        : { amountIn: Number(estimate.fromAmount) }
    ),
    amountOutMin: estimate.toMinAmount,
    networkFee: estimate.networkFee,
    realNetworkFee: estimate.realNetworkFee,
    swapFee: estimate.swapFee,
    priceImpact: estimate.impact,
    dexLabel: estimate.dexLabel,
    feeSource: SwapFeeSource.In,
    isEstimating: false,
    errorType: undefined,
  });
  setGlobal(global);
});

addActionHandler('estimateSwapCex', async (global, actions, { shouldBlock }) => {
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

  const from = tokenIn.slug === TON_TOKEN_SLUG ? tokenIn.symbol : tokenIn.contract!;
  const to = tokenOut.slug === TON_TOKEN_SLUG ? tokenOut.symbol : tokenOut.contract!;
  const fromAmount = safeNumberToString(global.currentSwap.amountIn ?? 0, tokenIn.decimals);

  const estimate = await callApi('swapCexEstimate', {
    fromAmount,
    from,
    to,
  });

  global = getGlobal();

  if (!estimate) {
    global = updateCurrentSwap(global, {
      ...resetParams,
      errorType: SwapErrorType.InvalidPair,
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
          && global.currentSwap.amountIn !== Number(estimate.fromAmount))
      || (global.currentSwap.inputSource === SwapInputSource.Out
          && global.currentSwap.amountOut !== Number(estimate.toAmount))
  ) {
    global = updateCurrentSwap(global, {
      ...resetParams,
    });
    setGlobal(global);
    return;
  }

  let networkFee = 0;

  if (global.currentSwap.swapType === SwapType.CrosschainFromTon) {
    const account = global.accounts?.byId[global.currentAccountId!];

    const txDraft = await callApi(
      'checkTransactionDraft',
      global.currentAccountId!,
      global.currentSwap.tokenInSlug!,
      account?.address!,
      humanToBigStr(global.currentSwap.amountIn ?? 0, tokenIn.decimals),
    );
    networkFee = bigStrToHuman(txDraft?.fee ?? '0');
  }

  global = getGlobal();

  const realAmountOut = Big(estimate.toAmount);

  global = updateCurrentSwap(global, {
    amountOut: realAmountOut.eq(0) ? undefined : Number(realAmountOut.toFixed(tokenOut.decimals)),
    limits: {
      fromMin: estimate.fromMin,
      fromMax: estimate.fromMax,
    },
    swapFee: estimate.swapFee,
    networkFee,
    realNetworkFee: networkFee,
    amountOutMin: String(realAmountOut),
    isEstimating: false,
    errorType: undefined,
  });
  setGlobal(global);
});

addActionHandler('setSwapScreen', (global, actions, { state }) => {
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

  const symbolOrMinter = tokenIn.slug === TON_TOKEN_SLUG ? tokenIn.symbol : tokenIn.contract!;

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
