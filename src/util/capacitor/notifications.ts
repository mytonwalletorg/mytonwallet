import { Capacitor } from '@capacitor/core';
import type { ActionPerformed, Token } from '@capacitor/push-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { getActions, getGlobal, setGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { selectAccountIdByAddress } from '../../global/selectors';
import { selectNotificationTonAddresses } from '../../global/selectors/notifications';
import { callApi } from '../../api';
import { MINUTE } from '../../api/constants';
import { logDebugError } from '../logs';
import { getCapacitorPlatform } from './platform';

interface BaseMessageData {
  address: string;
}

interface ShowTxMessageData extends BaseMessageData {
  action: 'swap' | 'staking' | 'nativeTx';
  txId: string;
}

interface OpenActivityMessageData extends BaseMessageData {
  action: 'jettonTx';
  slug: string;
}

type MessageData = OpenActivityMessageData | ShowTxMessageData;

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
    // For request IOS returns 'denied', but 'granted' follows immediately without a new requests.
    return;
  }

  await PushNotifications.register();
}

function handlePushNotificationActionPerformed(notification: ActionPerformed) {
  const { showAnyAccountTx, showAnyAccountTokenActivity } = getActions();
  const global = getGlobal();
  const notificationData = notification.notification.data as MessageData;
  const { action, address } = notificationData;
  const accountId = selectAccountIdByAddress(
    global,
    'ton',
    address,
  );

  if (!accountId) return;

  if (action === 'nativeTx' || action === 'swap') {
    const { txId } = notificationData;
    showAnyAccountTx({ accountId, txId, network: 'mainnet' });
  } else if (action === 'jettonTx') {
    const { slug } = notificationData;
    showAnyAccountTokenActivity({ accountId, slug, network: 'mainnet' });
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
        addresses: selectNotificationTonAddresses(global, notificationAccounts),
      });
      nextUpdatePushNotifications = Date.now() + (60 * MINUTE);
    }
  }, { capture: true });
}
