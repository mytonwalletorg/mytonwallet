import type { Table } from 'dexie';
import Dexie from 'dexie';

import type { ApiNft, ApiTokenWithPrice } from '../types';

import { DbRepository } from './repository';

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

  tokens!: Table<ApiTokenWithPrice>;

  constructor() {
    super(DB_NANE);
    this.version(1).stores({
      nfts: '[accountId+address], accountId, address, collectionAddress',
    });
    this.version(2).stores({
      sseConnections: '&clientId',
    });
    this.version(3).stores({
      tokens: 'tokenAddress, chain, &slug',
    });
    this.version(4).upgrade((tx) => {
      return tx.table('tokens').clear();
    });
  }
}

export const apiDb = new ApiDb();

export const nftRepository = new DbRepository(apiDb.nfts);
export const tokenRepository = new DbRepository(apiDb.tokens);
