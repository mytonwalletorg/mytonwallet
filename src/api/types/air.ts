import type { bigintReviver } from '../../util/bigint';
import type { callApi, initApi } from '../providers/direct/connector';
import type { WindowMethodResponse, WindowMethods } from '../storages/capacitorStorage';

interface IAirBridge {
  initApi: typeof initApi;
  callApi: typeof callApi;
  bigintReviver: typeof bigintReviver;
  nativeCallCallbacks: Record<
    number,
    (response: { ok: boolean; result?: WindowMethodResponse<keyof WindowMethods> }) => void
  >;
}

export type IAirWindow = Window & typeof globalThis & { airBridge: IAirBridge; webkit?: any; androidApp?: any };
