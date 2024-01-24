import type { ApiNft } from './types';

import Dexie from '../lib/dexie/dexie';
import Table = Dexie.Table;

export type ApiDbNft = ApiNft & {
  accountId: string;
  collectionAddress: string;
};

export type ApiDbSseConnection = {
  clientId: string;
};

const DB_NANE = 'tables';

export class ApiDb extends Dexie {
  nfts!: Table<ApiDbNft>;

  sseConnections!: Table<ApiDbSseConnection>;

  constructor() {
    super(DB_NANE);
    this.version(1).stores({
      nfts: '[accountId+address], accountId, address, collectionAddress',
    });
    this.version(2).stores({
      sseConnections: '&clientId',
    });
  }
}

export const apiDb = new ApiDb();
