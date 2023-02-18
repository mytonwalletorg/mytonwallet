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

export type ApiDappUpdate = ApiLegacyDappUpdate | ApiDappUpdateTonMagic;

export type ApiLegacyDappUpdate = ApiDappUpdateBalance | ApiDappUpdateAccounts;

export type OnApiDappUpdate = (update: ApiDappUpdate) => void;
