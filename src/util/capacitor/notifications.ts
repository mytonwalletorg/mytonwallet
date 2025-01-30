import { Capacitor } from '@capacitor/core';
import type { ActionPerformed, Token } from '@capacitor/push-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { getActions, getGlobal, setGlobal } from '../../global';

import type { ApiStakingType } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { selectAccountIdByAddress } from '../../global/selectors';
import { selectNotificationTonAddressesSlow } from '../../global/selectors/notifications';
import { callApi } from '../../api';
import { MINUTE } from '../../api/constants';
import { logDebugError } from '../logs';
import { getCapacitorPlatform } from './platform';

interface BaseMessageData {
  address: string;
}

interface ShowTxMessageData extends BaseMessageData {
  action: 'swap' | 'nativeTx';
  txId: string;
}

interface StakingMessageData extends BaseMessageData {
  action: 'staking';
  stakingType: ApiStakingType;
  stakingId: string;
  logId: string;
}

interface OpenActivityMessageData extends BaseMessageData {
  action: 'jettonTx';
  slug: string;
}
type MessageData = StakingMessageData | OpenActivityMessageData | ShowTxMessageData;

let nextUpdatePushNotifications = 0;

export async function initNotificationsWithGlobal(global: GlobalState) {
  const isPushNotificationsAvailable = Capacitor.isPluginAvailable('PushNotifications');

  setGlobal({
    ...global,
    pushNotifications: {
      ...global.pushNotifications,
      isAvailable: isPushNotificationsAvailable,
    },
  });

  if (!isPushNotificationsAvailable) {
    return;
  }

  await PushNotifications.addListener('pushNotificationActionPerformed', handlePushNotificationActionPerformed);

  await PushNotifications.addListener('registration', handlePushNotificationRegistration);

  await PushNotifications.addListener('registrationError', (err) => {
    logDebugError('Registration error: ', err.error);
  });

  let notificationStatus = await PushNotifications.checkPermissions();

  if (notificationStatus.receive === 'prompt-with-rationale') {
    return;
  }

  if (notificationStatus.receive === 'prompt') {
    notificationStatus = await PushNotifications.requestPermissions();
  }

  if (notificationStatus.receive !== 'granted') {
    // For request iOS returns 'denied', but 'granted' follows immediately without new requests
    return;
  }

  await PushNotifications.register();
}

function handlePushNotificationActionPerformed(notification: ActionPerformed) {
  const {
    showAnyAccountTx,
    showAnyAccountTokenActivity,
    openAnyAccountStakingInfo,
    closeAllOverlays,
  } = getActions();
  const global = getGlobal();
  const notificationData = notification.notification.data as MessageData;
  const { action, address } = notificationData;
  const accountId = selectAccountIdByAddress(
    global,
    'ton',
    address,
  );

  if (!accountId) return;

  const network = 'mainnet';

  closeAllOverlays();
  if (action === 'nativeTx' || action === 'swap') {
    const { txId } = notificationData;
    showAnyAccountTx({ accountId, txId, network });
  } else if (action === 'jettonTx') {
    const { slug } = notificationData;
    showAnyAccountTokenActivity({ accountId, slug, network });
  } else if (action === 'staking') {
    const { stakingId } = notificationData;
    openAnyAccountStakingInfo({ accountId, network, stakingId });
  }
}

function handlePushNotificationRegistration(token: Token) {
  const userToken = token.value;

  getActions().registerNotifications({ userToken, platform: getCapacitorPlatform()! });

  window.addEventListener('focus', async () => {
    const global = getGlobal();
    const notificationAccounts = Object.keys(global.pushNotifications.enabledAccounts || []);
    if (notificationAccounts.length && nextUpdatePushNotifications <= Date.now()) {
      await callApi('subscribeNotifications', {
        userToken,
        platform: getCapacitorPlatform()!,
        addresses: selectNotificationTonAddressesSlow(global, notificationAccounts),
      });
      nextUpdatePushNotifications = Date.now() + (60 * MINUTE);
    }
  }, { capture: true });
}
