import * as dappMethods from './index';

export type DappMethods = typeof dappMethods;
export type DappMethodArgs<N extends keyof DappMethods> = Parameters<DappMethods[N]>;
export type DappMethodResponse<N extends keyof DappMethods> = ReturnType<DappMethods[N]>;
