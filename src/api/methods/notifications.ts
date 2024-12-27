import type { NotificationAddress } from '../../global/selectors/notifications';
import type { CapacitorPlatform } from '../../util/capacitor/platform';

import { logDebugError } from '../../util/logs';
import { callBackendPost } from '../common/backend';
import { handleServerError } from '../errors';

export interface SubscribeNotificationsProps {
  userToken: string;
  platform: CapacitorPlatform;
  addresses: NotificationAddress[];
}

export interface UnsubscribeNotificationsProps {
  userToken: string;
  addresses: NotificationAddress[];
}

export interface NotificationsAccountValue {
  key: string;
}

export interface SubscribeNotificationsResult {
  ok: true;
  addressKeys: Record<string, NotificationsAccountValue>;
}

export async function subscribeNotifications(props: SubscribeNotificationsProps) {
  try {
    return await callBackendPost<SubscribeNotificationsResult>(
      '/notifications/subscribe', props, { shouldRetry: true },
    );
  } catch (err) {
    logDebugError('subscribeNotifications', err);
    return handleServerError(err);
  }
}

export async function unsubscribeNotifications(props: UnsubscribeNotificationsProps) {
  try {
    return await callBackendPost<{ ok: true }>(
      '/notifications/unsubscribe', props, { shouldRetry: true },
    );
  } catch (err) {
    logDebugError('unsubscribeNotifications', err);
    return handleServerError(err);
  }
}
