export type ApiDappUpdateBalance = {
  type: 'updateBalance';
  balance: string;
};

export type ApiDappUpdateAccounts = {
  type: 'updateAccounts';
  accounts: string[];
};

export type ApiDappUpdateTonMagic = {
  type: 'updateTonMagic';
  isEnabled: boolean;
};

export type ApiDappUpdate = ApiDappUpdateBalance | ApiDappUpdateAccounts | ApiDappUpdateTonMagic;

export type OnApiDappUpdate = (update: ApiDappUpdate) => void;
