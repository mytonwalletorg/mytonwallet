import type { ApiChain, ApiNetwork } from '../types';
import type { WalletWatcher } from './backendSocket';

import { focusAwareDelay, onFocusAwareDelay } from '../../util/focusAwareDelay';
import { pause, setCancellableTimeout, throttle } from '../../util/schedulers';
import { getBackendSocket } from './backendSocket';

const UPDATE_CALLBACK_DELAY = 10;

interface Period {
  focused: number;
  notFocused: number;
}

export interface WalletPollingOptions {
  chain: ApiChain;
  network: ApiNetwork;
  address: string;
  /** Whether an update should be triggerred when the polling object is created */
  updateOnStart?: boolean;
  /** The minimum delay between `onUpdate` calls */
  minUpdateDelay: Period;
  /**
   * How much time the fallback polling will start after the socket disconnects.
   * Also applies at the very beginning (until the socket is connected).
   */
  fallbackUpdateStartDelay: number;
  /** Update periods when the socket is disconnected */
  fallbackUpdatePeriod: Period;
  /** Update periods when the socket is connected but there is no new activity coming */
  forceUpdatePeriod: Period;
  /**
   * Called whenever the wallet data should be updated.
   * The polling always waits until the returned promise resolves before running this callback again.
   *
   * @param isConfident `true` when the update was reported by the socket. `false` when the update is initiated by a
   *  timer. If `false`, the app should check a piece of wallet before refreshing the whole data (to avoid excessive
   *  network requests).
   */
  onUpdate(isConfident: boolean): MaybePromise<unknown>;
}

/**
 * Helps polling wallet balance and activity. Uses the backend websocket as the primary signal source and falls back
 * to simple time intervals if the websocket is unavailable. It doesn't provide the updated data, it provides signals
 * when the data should be fetched using the plain HTTP API.
 */
export class WalletPolling {
  #options: WalletPollingOptions;

  #walletWatcher: WalletWatcher;

  #isDestroyed = false;

  /** Undefined when no update is pending. Otherwise, holds the `isConfident` value (see `onUpdate` for more details) */
  #pendingUpdate?: boolean;

  #cancelBackupUpdate?: NoneToVoidFunction;

  constructor(options: WalletPollingOptions) {
    this.#options = options;

    const backendSocket = getBackendSocket(options.network);
    this.#walletWatcher = backendSocket.watchWallets(
      [{ chain: options.chain, address: options.address }],
      {
        onNewActivity: this.#handleSocketNewActivity,
        onConnect: this.#handleSocketConnect,
        onDisconnect: this.#handleSocketDisconnect,
      },
    );
    if (this.#walletWatcher.isConnected) {
      this.#handleSocketConnect();
    } else {
      this.#handleSocketDisconnect();
    }

    if (options.updateOnStart) {
      this.#triggerBackupNotifications();
    }
  }

  public destroy() {
    this.#isDestroyed = true;
    this.#walletWatcher.destroy();
    this.#cancelBackupUpdate?.();
  }

  #handleSocketNewActivity = () => {
    this.#pendingUpdate = true;
    this.#runUpdateCallback();
    this.#scheduleBackupPolling();
  };

  #handleSocketConnect = () => {
    this.#triggerBackupNotifications();
    this.#scheduleBackupPolling();
  };

  #handleSocketDisconnect = () => {
    this.#scheduleFallbackPolling();
  };

  #triggerBackupNotifications() {
    this.#pendingUpdate ??= false;
    this.#runUpdateCallback();
  }

  #runUpdateCallback = throttle(async () => {
    if (this.#pendingUpdate === undefined) {
      return;
    }

    const { onUpdate, minUpdateDelay } = this.#options;

    try {
      // To let sneak in the updates arriving in short-time batches. Otherwise, they will cause another onUpdate call.
      await pause(UPDATE_CALLBACK_DELAY);
      if (this.#isDestroyed) return;

      const isConfident = this.#pendingUpdate;
      this.#pendingUpdate = undefined;
      await onUpdate(isConfident);
    } finally {
      await focusAwareDelay(
        minUpdateDelay.focused - UPDATE_CALLBACK_DELAY,
        minUpdateDelay.notFocused - UPDATE_CALLBACK_DELAY,
      );
    }
  }, 0);

  /** Sets up a manual polling running when the socket is connected (to mitigate network and backend problems) */
  #scheduleBackupPolling() {
    this.#cancelBackupUpdate?.();

    const schedule = () => {
      const { forceUpdatePeriod } = this.#options;
      this.#cancelBackupUpdate = onFocusAwareDelay(
        forceUpdatePeriod.focused,
        forceUpdatePeriod.notFocused,
        () => {
          schedule();
          this.#triggerBackupNotifications();
        },
      );
    };

    schedule();
  }

  /** Sets up a manual polling running when the socket is disconnected */
  #scheduleFallbackPolling() {
    this.#cancelBackupUpdate?.();

    const { fallbackUpdateStartDelay, fallbackUpdatePeriod } = this.#options;

    const handleTimeout = () => {
      this.#cancelBackupUpdate = onFocusAwareDelay(
        fallbackUpdatePeriod.focused,
        fallbackUpdatePeriod.notFocused,
        handleTimeout,
      );

      this.#triggerBackupNotifications();
    };

    this.#cancelBackupUpdate = setCancellableTimeout(fallbackUpdateStartDelay, handleTimeout);
  }
}
