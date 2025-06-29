import type { ApiChain } from './misc';

type ApiSubscriptionAddress = {
  chain: ApiChain;
  address: string;
  events: 'activity'[];
};

type ApiBaseClientSocketMessage = {
  /** An arbitrary unique (within the socket connection) id to link the response with the request */
  id: number;
};

type ApiSubscribeSocketMessage = ApiBaseClientSocketMessage & {
  type: 'subscribe';
  addresses: ApiSubscriptionAddress[];
};

type ApiOkSocketMessage = {
  type: 'ok';
  /** The id from the request */
  id: number;
};

type ApiErrorSocketMessage = {
  type: 'error';
  /** The id from the request */
  id?: number;
  error: string;
};

export type ApiNewActivitySocketMessage = {
  type: 'newActivity';
  blockId: number;
  chain: ApiChain;
  addresses: string[];
};

export type ApiSubscribedSocketMessage = {
  type: 'subscribed';
  /** The id from the request */
  id: number;
};

export type ApiClientSocketMessage = ApiSubscribeSocketMessage;
export type ApiServerSocketMessage =
  | ApiOkSocketMessage
  | ApiErrorSocketMessage
  | ApiSubscribedSocketMessage
  | ApiNewActivitySocketMessage;
