import type { ExtensionMethods } from '../extensionMethods/types';
import type { Methods } from '../methods/types';

export type AllMethods = Methods & ExtensionMethods;
export type AllMethodArgs<N extends keyof AllMethods> = Parameters<AllMethods[N]>;
export type AllMethodResponse<N extends keyof AllMethods> = ReturnType<AllMethods[N]>;
