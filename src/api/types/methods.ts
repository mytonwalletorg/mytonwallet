import type { ExtensionMethods } from '../extensionMethods/types';
import type { Methods } from '../methods/types';
import type { TonConnectMethods } from '../tonConnect/types/misc';

// These methods should be prefixed with 'tonConnect_' to use in InAppBrowser
type TonConnectMethodsWithPrefix = {
  [P in keyof TonConnectMethods as `tonConnect_${P}`]: TonConnectMethods[P]
};

export type AllMethods = Methods & ExtensionMethods & TonConnectMethodsWithPrefix;
export type AllMethodArgs<N extends keyof AllMethods> = Parameters<AllMethods[N]>;
export type AllMethodResponse<N extends keyof AllMethods> = ReturnType<AllMethods[N]>;
