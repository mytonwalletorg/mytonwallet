export enum StorageType {
  IndexedDb,
  LocalStorage,
}

export interface Storage {
  getItem(name: string): Promise<any>;

  setItem(name: string, value: any): Promise<void>;

  removeItem(name: string): Promise<void>;

  clear(): Promise<void>;
}
