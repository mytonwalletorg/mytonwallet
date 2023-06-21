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

export type ApiDappUpdateDeeplinkHook = {
  type: 'updateDeeplinkHook';
  isEnabled: boolean;
};

export type ApiDappDisconnect = {
  type: 'disconnectDapp';
  origin: string;
};

export type ApiDappUpdate = ApiLegacyDappUpdate
| ApiDappUpdateTonMagic
| ApiDappUpdateDeeplinkHook
| ApiDappDisconnect;

export type ApiLegacyDappUpdate = ApiDappUpdateBalance | ApiDappUpdateAccounts;

export type OnApiDappUpdate = (update: ApiDappUpdate) => void;
