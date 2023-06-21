import type * as tonConnectMethods from '../index';

export type TonConnectMethods = typeof tonConnectMethods;
export type TonConnectMethodArgs<N extends keyof TonConnectMethods> = Parameters<TonConnectMethods[N]>;
export type TonConnectMethodResponse<N extends keyof TonConnectMethods> = ReturnType<TonConnectMethods[N]>;
