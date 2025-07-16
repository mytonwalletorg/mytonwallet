import type { IAirWindow } from '../types/air';

import { bigintReviver } from '../../util/bigint';
import { callApi, initApi } from '../providers/direct/connector';

export const airWindow = window as IAirWindow;

airWindow.airBridge = {
  initApi,
  callApi,
  bigintReviver,
  nativeCallCallbacks: {},
};
