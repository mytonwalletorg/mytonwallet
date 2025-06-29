import { addCallback as onGlobalChange } from '../lib/teact/teactn';
import { getActions, getGlobal, setGlobal } from '../global';

import type { ActionPayloads, GlobalState } from '../global/types';
import type { Log } from './logs';

import { MULTITAB_DATA_CHANNEL_NAME } from '../config';
import { deepDiff } from './deepDiff';
import { deepMerge } from './deepMerge';
import { omit } from './iteratees';
import { getLogs } from './logs';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET, IS_MULTITAB_SUPPORTED } from './windowEnvironment';

import { isBackgroundModeActive } from '../hooks/useBackgroundMode';

interface BroadcastChannelGlobalDiff {
  type: 'globalDiffUpdate';
  diff: any;
}

interface BroadcastChannelCallActionInMain<K extends keyof ActionPayloads> {
  type: 'callActionInMain';
  name: K;
  options?: ActionPayloads[K];
}

interface BroadcastChannelCallActionInNative<K extends keyof ActionPayloads> {
  type: 'callActionInNative';
  name: K;
  options?: ActionPayloads[K];
}

interface BroadcastChannelNativeLogsRequest {
  type: 'getLogsFromNative';
}

interface BroadcastChannelNativeLogsResponse {
  type: 'logsFromNative';
  logs: Log[];
}

type BroadcastChannelMessage = BroadcastChannelGlobalDiff
  | BroadcastChannelCallActionInMain<keyof ActionPayloads>
  | BroadcastChannelCallActionInNative<keyof ActionPayloads>
  | BroadcastChannelNativeLogsRequest
  | BroadcastChannelNativeLogsResponse;
type EventListener = (type: 'message', listener: (event: { data: BroadcastChannelMessage }) => void) => void;

export type TypedBroadcastChannel = {
  postMessage: (message: BroadcastChannelMessage) => void;
  addEventListener: EventListener;
  removeEventListener: EventListener;
};

const channel = IS_MULTITAB_SUPPORTED
  ? new BroadcastChannel(MULTITAB_DATA_CHANNEL_NAME) as TypedBroadcastChannel
  : undefined;

let currentGlobal = getGlobal();

export function initMultitab({ noPubGlobal }: { noPubGlobal?: boolean } = {}) {
  if (!channel) return;

  if (!noPubGlobal) {
    onGlobalChange(handleGlobalChange);
  }

  channel.addEventListener('message', handleMultitabMessage);
}

function handleGlobalChange(global: GlobalState) {
  if (global === currentGlobal) return;

  // One of the goals of this check is preventing the Delegated Bottom Sheet global state initialization (performed by
  // src/global/init.ts) from propagating to the main WebView. Normally this is prevented by `isBackgroundModeActive()`
  // (the Sheet should be out of focus during the initialization), but we suspect that this approach is not fully
  // reliable, because the focus may be in the Sheet during the initialization. So an extra `isInited` check is used -
  // `isInited: false` appears only in the initial Teactn global state (see src/lib/teact/teactn.tsx) and we expect the
  // first global change to be the initialization.
  if (isBackgroundModeActive() || (currentGlobal as AnyLiteral).isInited === false) {
    currentGlobal = global;
    return;
  }

  const diff = deepDiff(omitLocalOnlyKeys(currentGlobal), omitLocalOnlyKeys(global));

  if (typeof diff !== 'symbol') {
    channel!.postMessage({
      type: 'globalDiffUpdate',
      diff,
    });
  }

  currentGlobal = global;
}

function omitLocalOnlyKeys(global: GlobalState) {
  return omit(global, ['DEBUG_randomId']);
}

function handleMultitabMessage({ data }: { data: BroadcastChannelMessage }) {
  switch (data.type) {
    case 'globalDiffUpdate': {
      if (IS_DELEGATED_BOTTOM_SHEET) return;

      currentGlobal = deepMerge(getGlobal(), data.diff);

      setGlobal(currentGlobal);

      break;
    }

    case 'callActionInMain': {
      if (!IS_DELEGATING_BOTTOM_SHEET) return;

      const { name, options } = data;

      getActions()[name](options as never);
      break;
    }

    case 'callActionInNative': {
      if (!IS_DELEGATED_BOTTOM_SHEET) return;

      const { name, options } = data;

      getActions()[name](options as never);
      break;
    }

    case 'getLogsFromNative': {
      if (!IS_DELEGATED_BOTTOM_SHEET) return;

      channel!.postMessage({ type: 'logsFromNative', logs: getLogs() });
      break;
    }
  }
}

export function callActionInMain<K extends keyof ActionPayloads>(name: K, options?: ActionPayloads[K]) {
  channel!.postMessage({
    type: 'callActionInMain',
    name,
    options,
  });
}

export function callActionInNative<K extends keyof ActionPayloads>(name: K, options?: ActionPayloads[K]) {
  channel!.postMessage({
    type: 'callActionInNative',
    name,
    options,
  });
}

export function getLogsFromNative() {
  if (!IS_DELEGATING_BOTTOM_SHEET) return Promise.resolve([]);

  return new Promise<Log[]>((resolve) => {
    const handleMessage = ({ data }: { data: BroadcastChannelMessage }) => {
      if (data.type === 'logsFromNative') {
        channel!.removeEventListener('message', handleMessage);
        resolve(data.logs);
      }
    };

    channel!.addEventListener('message', handleMessage);
    channel!.postMessage({ type: 'getLogsFromNative' });
  });
}
