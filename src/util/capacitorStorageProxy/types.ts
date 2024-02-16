import type * as windowMethods from './methods';

export type WindowMethods = typeof windowMethods;
export type WindowMethodArgs<N extends keyof WindowMethods> = Parameters<WindowMethods[N]>;
export type WindowMethodResponse<N extends keyof WindowMethods> = ReturnType<WindowMethods[N]>;
