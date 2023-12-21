export enum StorageType {
  IndexedDb,
  LocalStorage,
  ExtensionLocal,
}

export interface Storage {
  getItem(name: StorageKey): Promise<any>;

  setItem(name: StorageKey, value: any): Promise<void>;

  removeItem(name: StorageKey): Promise<void>;

  clear(): Promise<void>;

  getAll(): Promise<AnyLiteral>;

  setMany(items: AnyLiteral): Promise<void>;

  getMany(keys: string[]): Promise<AnyLiteral>;
}

export type StorageKey = 'mnemonicsEncrypted'
| 'accounts'
| 'stateVersion'
| 'currentAccountId'
| 'clientId'
| 'baseCurrency'
// For extension
| 'dapps'
| 'dappMethods:lastAccountId'
| 'windowId'
| 'windowState'
| 'isTonMagicEnabled'
| 'isTonProxyEnabled'
| 'isDeeplinkHookEnabled'
// For TonConnect SSE
| 'sseLastEventId';
