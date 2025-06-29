import { useCallback, useEffect, useRef } from '../lib/teact/teact';

import { IS_TELEGRAM_APP, IS_TEST } from '../config';
import { requestMeasure } from '../lib/fasterdom/fasterdom';
import {
  registerCallback as registerTelegramCallback,
  unregisterCallback as unregisterTelegramCallback,
} from '../util/telegram/backButtonManager';
import { IS_IOS, IS_LEDGER_EXTENSION_TAB } from '../util/windowEnvironment';
import useEffectOnce from './useEffectOnce';
import useLastCallback from './useLastCallback';
import useSyncEffect from './useSyncEffect';

const PATH_BASE = `${window.location.pathname}${window.location.search}`;

type HistoryRecord = {
  index: number;
  // Should this record be replaced by the next record (for example Menu)
  shouldBeReplaced?: boolean;
  // Mark this record as replaced by the next record. Only used to check if needed to perform effectBack
  markReplaced?: NoneToVoidFunction;
  onBack?: NoneToVoidFunction;
  // Set if the element is closed in the UI, but not in the real history
  isClosed?: boolean;
};

type HistoryOperationGo = {
  type: 'go';
  delta: number;
};

type HistoryOperationState = {
  type: 'pushState' | 'replaceState';
  data: any;
};

type HistoryOperation = HistoryOperationGo | HistoryOperationState;

// Needed to dismiss any 'trashed' history records from the previous page reloads.
const historyUniqueSessionId = Number(new Date());
// Reflects real history state, but also contains information on which records should be replaced by the next record and
// which records are deferred to close on the next operation
let historyState: HistoryRecord[];
// Reflects current real history index
let historyCursor: number;
// If we alter real history programmatically, the popstate event will be fired, which we don't need
let isAlteringHistory = false;
// Unfortunately Safari doesn't really like when there's 2+ consequent history operations in one frame, so we need
// to delay them to the next raf
let deferredHistoryOperations: HistoryOperation[] = [];
let deferredPopstateOperations: HistoryOperationState[] = [];

// Do not remove: used for history unit tests
if (IS_TEST) {
  (window as any).TEST_getHistoryState = () => historyState;
  (window as any).TEST_getHistoryCursor = () => historyCursor;
}

function applyDeferredHistoryOperations() {
  const goOperations = deferredHistoryOperations.filter((op) => op.type === 'go');
  const stateOperations = deferredHistoryOperations.filter((op) => op.type !== 'go');
  const goCount = goOperations.reduce((acc, op) => acc + op.delta, 0);

  deferredHistoryOperations = [];

  if (goCount) {
    window.history.go(goCount);

    // If we have some `state` operations after the `go` operations, we need to wait until the popstate event
    // so the order of operations is correctly preserved
    if (stateOperations.length) {
      deferredPopstateOperations.push(...stateOperations);
      return;
    }
  }

  processStateOperations(stateOperations);
}

function processStateOperations(stateOperations: HistoryOperationState[]) {
  stateOperations.forEach((op) => window.history[op.type](op.data, ''));
}

function deferHistoryOperation(historyOperation: HistoryOperation) {
  if (!deferredHistoryOperations.length) {
    requestMeasure(applyDeferredHistoryOperations);
  }

  deferredHistoryOperations.push(historyOperation);
}

// Resets history to the `root` state
function resetHistory() {
  historyCursor = 0;
  historyState = [{
    index: 0,
    onBack: () => window.history.back(),
  }];

  if (!IS_LEDGER_EXTENSION_TAB) {
    window.history.replaceState({ index: 0, historyUniqueSessionId }, '', PATH_BASE);
  }
}

resetHistory();

function cleanupClosed(alreadyClosedCount = 1) {
  let countClosed = alreadyClosedCount;
  for (let i = historyCursor - 1; i > 0; i--) {
    if (!historyState[i].isClosed) break;
    countClosed++;
  }
  if (countClosed) {
    isAlteringHistory = true;
    deferHistoryOperation({
      type: 'go',
      delta: -countClosed,
    });
  }
  return countClosed;
}

function cleanupTrashedState() {
  for (let i = historyState.length - 1; i > 0; i--) {
    if (historyState[i].isClosed) {
      continue;
    }
    historyState[i].onBack?.();
  }

  resetHistory();
}

window.addEventListener('popstate', ({ state }: PopStateEvent) => {
  if (isAlteringHistory) {
    isAlteringHistory = false;
    if (deferredPopstateOperations.length) {
      processStateOperations(deferredPopstateOperations);
      deferredPopstateOperations = [];
    }
    return;
  }

  if (!state) {
    cleanupTrashedState();
    return;
  }

  const { index, historyUniqueSessionId: previousUniqueSessionId } = state;
  if (previousUniqueSessionId !== historyUniqueSessionId) {
    cleanupTrashedState();
    return;
  }

  // New real history state matches the old virtual one. Not possible in theory, but in practice we have Safari
  if (index === historyCursor) {
    return;
  }

  if (index < historyCursor) {
    // Navigating back
    let alreadyClosedCount = 0;
    for (let i = historyCursor; i > index - alreadyClosedCount; i--) {
      if (historyState[i].isClosed) {
        alreadyClosedCount++;
        continue;
      }
      historyState[i].onBack?.();
    }

    const countClosed = cleanupClosed(alreadyClosedCount);
    historyCursor += index - historyCursor - countClosed;

    // Can happen when we have deferred a real back for some element (for example Menu), closed via UI,
    // pressed back button and caused a pushState.
    if (historyCursor < 0) {
      historyCursor = 0;
    }
  } else if (index > historyCursor) {
    // Forward navigation is not yet supported
    isAlteringHistory = true;
    deferHistoryOperation({
      type: 'go',
      delta: -(index - historyCursor),
    });
  }
});

export default function useHistoryBack({
  isActive,
  shouldBeReplaced,
  shouldIgnoreForTelegram,
  onBack,
}: {
  isActive?: boolean;
  shouldBeReplaced?: boolean;
  shouldIgnoreForTelegram?: boolean;
  onBack: NoneToVoidFunction;
}) {
  const lastOnBack = useLastCallback(onBack);

  // Active index of the record
  const indexRef = useRef<number>();
  const telegramIdRef = useRef<number>();
  const wasReplaced = useRef(false);

  const isFirstRender = useRef(true);

  const pushState = useCallback((forceReplace = false) => {
    // Check if the old state should be replaced
    const shouldReplace = forceReplace || historyState[historyCursor].shouldBeReplaced;
    indexRef.current = shouldReplace ? historyCursor : ++historyCursor;

    historyCursor = indexRef.current;

    // Mark the previous record as replaced so effectBack doesn't perform back operation on the new record
    const previousRecord = historyState[indexRef.current];
    if (previousRecord && !previousRecord.isClosed) {
      previousRecord.markReplaced?.();
    }

    historyState[indexRef.current] = {
      index: indexRef.current,
      onBack: lastOnBack,
      shouldBeReplaced,
      markReplaced: () => {
        wasReplaced.current = true;
      },
    };

    deferHistoryOperation({
      type: shouldReplace ? 'replaceState' : 'pushState',
      data: {
        index: indexRef.current,
        historyUniqueSessionId,
      },
    });
  }, [lastOnBack, shouldBeReplaced]);

  const processBack = useCallback(() => {
    // Only process back on open records
    if (indexRef.current && historyState[indexRef.current] && !wasReplaced.current) {
      historyState[indexRef.current].isClosed = true;
      wasReplaced.current = true;
      if (indexRef.current === historyCursor && !shouldBeReplaced) {
        historyCursor -= cleanupClosed();
      }
    }
  }, [shouldBeReplaced]);

  // Process back navigation when element is unmounted
  useEffectOnce(() => {
    if (IS_IOS) return undefined;

    isFirstRender.current = false;
    return () => {
      if (!isActive || wasReplaced.current) return;
      processBack();
    };
  });

  useSyncEffect(([prevIsActive]) => {
    if (IS_IOS) return;
    if (prevIsActive === isActive) return;
    if (isFirstRender.current && !isActive) return;

    if (isActive) {
      pushState();
    } else {
      processBack();
    }
  }, [isActive, processBack, pushState]);

  useEffect(() => {
    if (!IS_TELEGRAM_APP || shouldIgnoreForTelegram || !isActive) return undefined;

    telegramIdRef.current = registerTelegramCallback(lastOnBack);

    return () => {
      if (telegramIdRef.current !== undefined) {
        unregisterTelegramCallback(telegramIdRef.current);
        telegramIdRef.current = undefined;
      }
    };
  }, [isActive, shouldIgnoreForTelegram, onBack]);
}
