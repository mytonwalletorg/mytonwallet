import type {
  ApiSubscribeNotificationsProps, ApiSubscribeNotificationsResult, ApiUnsubscribeNotificationsProps,
} from '../types';

import { logDebugError } from '../../util/logs';
import { callBackendPost } from '../common/backend';
import { handleServerError } from '../errors';

export async function subscribeNotifications(props: ApiSubscribeNotificationsProps) {
  try {
    return await callBackendPost<ApiSubscribeNotificationsResult>(
      '/notifications/subscribe', props, { shouldRetry: true },
    );
  } catch (err) {
    logDebugError('subscribeNotifications', err);
    return handleServerError(err);
  }
}

export async function unsubscribeNotifications(props: ApiUnsubscribeNotificationsProps) {
  try {
    return await callBackendPost<{ ok: true }>(
      '/notifications/unsubscribe', props, { shouldRetry: true },
    );
  } catch (err) {
    logDebugError('unsubscribeNotifications', err);
    return handleServerError(err);
  }
}
