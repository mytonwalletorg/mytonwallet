import type { ApiActivity, ApiNetwork } from '../../../types';
import type { ActivitiesUpdate, WalletWatcher } from './socket';

import { createCallbackManager } from '../../../../util/callbacks';
import { compareActivities } from '../../../../util/compareActivities';
import { focusAwareDelay } from '../../../../util/focusAwareDelay';
import { extractKey } from '../../../../util/iteratees';
import { logDebugError } from '../../../../util/logs';
import { FallbackPollingScheduler } from '../../../common/polling/fallbackPollingScheduler';
import { periodToMs } from '../../../common/polling/utils';
import { FIRST_TRANSACTIONS_LIMIT, MINUTE, SEC } from '../../../constants';
import { fetchActions, fetchPendingActions } from './actions';
import { getToncenterSocket, isActivityUpdateFinal } from './socket';
import { throttleToncenterSocketActions } from './throttleSocketActions';

const SOCKET_THROTTLE_DELAY = 250;
const MIN_POLL_DELAY = { focused: SEC, notFocused: 3 * SEC };
const POLLING_START_DELAY = 3 * SEC;
const POLLING_PERIOD = { focused: 1.1 * SEC, notFocused: 10 * SEC };
const FORCED_POLLING_PERIOD = { focused: MINUTE, notFocused: 2 * MINUTE };

const FINISHED_HASH_MEMORY_SIZE = 100;

/**
 * The activities are sorted by timestamp descending.
 * The updates may arrive not in the order of activity time and may duplicate.
 * `allPendingActivities` doesn't contain activities with the hashes of the current or past confirmed activities.
 */
export type OnActivityUpdate = (
  newConfirmedActivities: ApiActivity[],
  allPendingActivities: readonly ApiActivity[],
) => void;

export type OnLoadingChange = (isLoading: boolean) => void;

/**
 * Streams the new activities (confirmed and pending) in the given TON wallet as they are received from the Toncenter
 * API (with no artificial activities like CEX swaps). Uses the socket, and fallbacks to HTTP polling when the socket is
 * unavailable.
 */
export class ActivityStream {
  #network: ApiNetwork;
  #address: string;

  #newestConfirmedActivityTimestamp?: number;

  #pendingActivities = managePendingActivities();

  #walletWatcher: WalletWatcher;

  #fallbackPollingScheduler: FallbackPollingScheduler;

  #updateListeners = createCallbackManager<OnActivityUpdate>();
  #loadingListeners = createCallbackManager<OnLoadingChange>();

  /** When `true`, the polling retries until succeeds, and the confirmed actions from the socket get stashed */
  #doesNeedToRestoreHistory = false;

  /** Sorted by timestamp descending */
  #socketConfirmedActionsStash: ApiActivity[] = [];

  #isDestroyed = false;

  constructor(
    network: ApiNetwork,
    address: string,
    newestConfirmedActivityTimestamp: number | undefined,
    pollOnStart: boolean,
  ) {
    this.#network = network;
    this.#address = address;
    this.#newestConfirmedActivityTimestamp = newestConfirmedActivityTimestamp;

    this.#walletWatcher = getToncenterSocket(network).watchWallets(
      [address],
      {
        onConnect: this.#handleSocketConnect,
        onDisconnect: this.#handleSocketDisconnect,
        onNewActivities: throttleToncenterSocketActions(SOCKET_THROTTLE_DELAY, this.#handleSocketNewActivities),
      },
    );

    this.#doesNeedToRestoreHistory = this.#walletWatcher.isConnected;

    this.#fallbackPollingScheduler = new FallbackPollingScheduler(this.#walletWatcher.isConnected, {
      pollOnStart,
      minPollDelay: MIN_POLL_DELAY,
      pollingStartDelay: POLLING_START_DELAY,
      pollingPeriod: POLLING_PERIOD,
      forcedPollingPeriod: FORCED_POLLING_PERIOD,
      poll: this.#poll,
    });
  }

  /**
   * Registers a callback firing then new activities arrive.
   * The callback is calls are throttled.
   */
  public onUpdate(callback: OnActivityUpdate) {
    return this.#updateListeners.addCallback(callback);
  }

  /**
   * Registers a callback firing when the regular polling starts of finishes.
   * Guaranteed to be called with `isLoading=false` after calling the `onUpdate` callbacks.
   */
  public onLoadingChange(callback: OnLoadingChange) {
    return this.#loadingListeners.addCallback(callback);
  }

  public destroy() {
    this.#isDestroyed = true;
    this.#walletWatcher.destroy();
    this.#fallbackPollingScheduler.destroy();
  }

  #handleSocketConnect = () => {
    // When the socket gets connected, it's important to load the confirmed activities since the last activity,
    // otherwise the activities arriving from the socket will create a gap in the activity history.
    this.#doesNeedToRestoreHistory = true;
    this.#fallbackPollingScheduler.onSocketConnect();
  };

  #handleSocketDisconnect = () => {
    this.#doesNeedToRestoreHistory = false;
    this.#fallbackPollingScheduler.onSocketDisconnect();
  };

  #handleSocketNewActivities = (updates: ActivitiesUpdate[]) => {
    if (this.#isDestroyed) return;

    const pendingUpdates = updates.filter((update) => update.arePending);
    const confirmedActivities = updates
      .filter((update) => !update.arePending)
      .flatMap((update) => update.activities)
      .sort(compareActivities);

    const instantConfirmedActivities = this.#doesNeedToRestoreHistory ? [] : confirmedActivities;
    const stashedConfirmedActivities = this.#doesNeedToRestoreHistory ? confirmedActivities : [];

    // One of the goals here is preventing the stashed activities from removing pending activities (switching an activity
    // from pending to confirmed must be seamless). Another goal is delivering the pending activities with no delay.
    this.#socketConfirmedActionsStash.unshift(...stashedConfirmedActivities);
    this.#handleNewActivities(instantConfirmedActivities, undefined, pendingUpdates);
  };

  /** Fetches the activities when the socket is not connected or has just connected */
  #poll = async () => {
    try {
      this.#loadingListeners.runCallbacks(true);

      const [pendingActivities, newConfirmedActivities] = await Promise.all([
        loadPendingActivities(this.#network, this.#address),
        this.#loadNewConfirmedActivities(),
      ]);

      if (this.#isDestroyed) return;

      this.#handleNewActivities(
        margeConfirmedActivitiesOnSocketConnect(
          newConfirmedActivities,
          this.#socketConfirmedActionsStash.splice(0),
        ),
        pendingActivities,
      );

      this.#doesNeedToRestoreHistory = false;
    } finally {
      if (!this.#isDestroyed) {
        this.#loadingListeners.runCallbacks(false);
      }
    }
  };

  async #loadNewConfirmedActivities() {
    while (!this.#isDestroyed) {
      try {
        return await fetchActions({
          network: this.#network,
          filter: { address: this.#address },
          walletAddress: this.#address,
          fromTimestamp: this.#newestConfirmedActivityTimestamp,
          limit: FIRST_TRANSACTIONS_LIMIT,
        });
      } catch (err) {
        logDebugError('loadNewConfirmedActivities', err);

        if (this.#isDestroyed || !this.#doesNeedToRestoreHistory) {
          break;
        }

        await focusAwareDelay(...periodToMs(MIN_POLL_DELAY));
      }
    }

    return [];
  }

  /** The method expected one of `allPendingActivities` and `pendingUpdates`, not both at the same time */
  #handleNewActivities(
    confirmedActivities: ApiActivity[],
    allPendingActivities?: ApiActivity[],
    pendingUpdates?: ActivitiesUpdate[],
  ) {
    // If nothing new, do nothing
    if (!confirmedActivities.length && !(allPendingActivities || pendingUpdates?.length)) {
      return;
    }

    if (confirmedActivities.length) {
      this.#newestConfirmedActivityTimestamp = confirmedActivities[0].timestamp;
    }
    this.#pendingActivities.update(confirmedActivities, allPendingActivities, pendingUpdates);
    this.#updateListeners.runCallbacks(confirmedActivities, this.#pendingActivities.all);
  }
}

async function loadPendingActivities(network: ApiNetwork, address: string) {
  try {
    return await fetchPendingActions(network, address);
  } catch (err) {
    logDebugError('loadPendingActivities', err);
    return undefined;
  }
}

/**
 * Keeps the list of all current pending activities by merging the incoming updates.
 */
function managePendingActivities() {
  /** Sorted by timestamp descending */
  let pendingActivities: readonly ApiActivity[] = [];

  /**
   * External message hash normalized of the recently confirmed activities and invalidated pending activities.
   * Helps to avoid excessive pendings occurring because of race conditions that cause pendings to arrive after the
   * corresponding confirmed activities. The race conditions can occur because of the socket and polling working together.
   *
   * There still can be situations where an older pending activity version replaces a newer one, but it is not a problem.
   */
  const finishedHashes = new Set<string>();

  function update(
    confirmedActivities: ApiActivity[],
    allPendingActivities?: readonly ApiActivity[],
    pendingUpdates?: ActivitiesUpdate[],
  ) {
    rememberFinishedHashes(extractKey(confirmedActivities, 'externalMsgHashNorm'));
    if (pendingUpdates) {
      rememberFinishedHashes(extractKey(pendingUpdates.filter(isActivityUpdateFinal), 'messageHashNormalized'));
    }

    if (allPendingActivities) {
      pendingActivities = allPendingActivities;
    } else if (pendingUpdates) {
      pendingActivities = mergePendingActivities(pendingActivities, pendingUpdates);
    }

    pendingActivities = pendingActivities.filter(({ externalMsgHashNorm }) => !(
      externalMsgHashNorm
      && finishedHashes.has(externalMsgHashNorm)
    ));
  }

  function rememberFinishedHashes(messageHashNorms: Iterable<string | undefined>) {
    for (const hash of messageHashNorms) {
      if (hash !== undefined) {
        finishedHashes.add(hash);
      }
    }

    releaseFinishedHashesMemory();
  }

  function releaseFinishedHashesMemory() {
    // JS Set iterates the elements in the order of insertion.
    // Deleting elements from Set during iteration doesn't disrupt the iteration.
    // That is, this loop removes the oldest elements.
    for (const hash of finishedHashes) {
      if (finishedHashes.size <= FINISHED_HASH_MEMORY_SIZE) {
        break;
      }

      finishedHashes.delete(hash);
    }
  }

  return {
    get all() {
      return pendingActivities;
    },
    update,
  };
}

/**
 * Merges the activities when the socket gets connected. At this moment of connection the socket starts receiving
 * activities, and activities are requested via the HTTP endpoint. These lists can contain duplicates, this function
 * eliminates them.
 *
 * Both the activity lists must be sorted by timestamp descending.
 */
function margeConfirmedActivitiesOnSocketConnect(
  polledActivities: ApiActivity[],
  socketActivities: ApiActivity[],
) {
  const newestPolledActivityTimestamp = polledActivities[0]?.timestamp ?? -Infinity;
  const mergedActivities: ApiActivity[] = [];

  for (const activity of socketActivities) {
    if (activity.timestamp <= newestPolledActivityTimestamp) {
      break;
    }

    mergedActivities.push(activity);
  }

  mergedActivities.push(...polledActivities);

  return mergedActivities;
}

function mergePendingActivities(
  currentPendingActivities: readonly ApiActivity[],
  socketUpdates: ActivitiesUpdate[],
) {
  if (!socketUpdates.length) {
    return currentPendingActivities;
  }

  const hashesToRemove = new Set<string | undefined>(
    extractKey(socketUpdates, 'messageHashNormalized'),
  );

  return [
    ...currentPendingActivities.filter(
      (activity) => !hashesToRemove.has(activity.externalMsgHashNorm),
    ),
    ...socketUpdates.flatMap((update) => update.arePending ? update.activities : []),
  ].sort(compareActivities);
}
