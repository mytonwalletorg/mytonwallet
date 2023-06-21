import type * as dappMethods from './index';
import type * as legacyDappMethods from './legacy';

export type DappMethods = typeof dappMethods;
export type DappMethodArgs<N extends keyof DappMethods> = Parameters<DappMethods[N]>;
export type DappMethodResponse<N extends keyof DappMethods> = ReturnType<DappMethods[N]>;

export type LegacyDappMethods = typeof legacyDappMethods;
export type LegacyDappMethodArgs<N extends keyof LegacyDappMethods> = Parameters<LegacyDappMethods[N]>;
export type LegacyDappMethodResponse<N extends keyof LegacyDappMethods> = ReturnType<LegacyDappMethods[N]>;
