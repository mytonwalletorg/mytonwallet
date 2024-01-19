import { addCallback } from '../lib/teact/teactn';
import { getActions, getGlobal, setGlobal } from '../global';

import type { ActionPayloads, GlobalState } from '../global/types';

import { MULTITAB_DATA_CHANNEL_NAME } from '../config';
import { deepDiff } from './deepDiff';
import { deepMerge } from './deepMerge';
import { omit } from './iteratees';
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

type BroadcastChannelMessage = BroadcastChannelGlobalDiff
| BroadcastChannelCallActionInMain<keyof ActionPayloads>
| BroadcastChannelCallActionInNative<keyof ActionPayloads>;
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
    addCallback(handleGlobalChange);
  }

  channel.addEventListener('message', handleMultitabMessage);
}

function handleGlobalChange(global: GlobalState) {
  if (global === currentGlobal) return;

  if (isBackgroundModeActive()) {
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
  return omit(global, ['DEBUG_capturedId']);
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
