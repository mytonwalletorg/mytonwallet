import type { ApiNft } from './types';

import Dexie from '../lib/dexie/dexie';
import Table = Dexie.Table;

export type ApiDbNft = ApiNft & {
  accountId: string;
  collectionAddress: string;
};

const DB_NANE = 'tables';

export class ApiDb extends Dexie {
  nfts!: Table<ApiDbNft>;

  constructor() {
    super(DB_NANE);
    this.version(1).stores({
      nfts: '[accountId+address], accountId, address, collectionAddress',
    });
  }
}

export const apiDb = new ApiDb();
