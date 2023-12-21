import { addCallback } from '../lib/teact/teactn';
import { getGlobal, setGlobal } from '../global';

import type { GlobalState } from '../global/types';

import { MULTITAB_DATA_CHANNEL_NAME } from '../config';
import { deepDiff } from './deepDiff';
import { deepMerge } from './deepMerge';
import { omit } from './iteratees';
import { IS_MULTITAB_SUPPORTED } from './windowEnvironment';

import { isBackgroundModeActive } from '../hooks/useBackgroundMode';

interface BroadcastChannelGlobalDiff {
  type: 'globalDiffUpdate';
  diff: any;
}

type BroadcastChannelMessage = BroadcastChannelGlobalDiff;
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

export function initMultitab({ noPub, noSub }: { noPub?: boolean; noSub?: boolean } = {}) {
  if (!channel) return;

  if (!noPub) {
    addCallback(handleGlobalChange);
  }

  if (!noSub) {
    channel.addEventListener('message', handleMultitabMessage);
  }
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
      currentGlobal = deepMerge(getGlobal(), data.diff);

      setGlobal(currentGlobal);

      break;
    }
  }
}
