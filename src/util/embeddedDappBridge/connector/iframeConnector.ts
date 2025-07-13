import {
  EMBEDDED_DAPP_BRIDGE_CHANNEL,
  TONCONNECT_PROTOCOL_VERSION,
  TONCONNECT_WALLET_JSBRIDGE_KEY,
} from '../../../config';
import { tonConnectGetDeviceInfo } from '../../tonConnectEnvironment';
import { initConnector } from './connector';

export function initIframeBridgeConnector() {
  initConnector(
    TONCONNECT_WALLET_JSBRIDGE_KEY,
    EMBEDDED_DAPP_BRIDGE_CHANNEL,
    window.parent,
    {
      deviceInfo: tonConnectGetDeviceInfo(),
      protocolVersion: TONCONNECT_PROTOCOL_VERSION,
      isWalletBrowser: true,
    },
  );
}
