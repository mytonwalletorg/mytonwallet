export type ApiDappUpdateBalance = {
  type: 'updateBalance';
  balance: string;
};

export type ApiDappUpdateAccounts = {
  type: 'updateAccounts';
  accounts: string[];
};

export type ApiSiteUpdateTonMagic = {
  type: 'updateTonMagic';
  isEnabled: boolean;
};

export type ApiSiteUpdateDeeplinkHook = {
  type: 'updateDeeplinkHook';
  isEnabled: boolean;
};

export type ApiSiteDisconnect = {
  type: 'disconnectSite';
  url: string;
};

export type ApiSiteUpdate = ApiLegacyDappUpdate
  | ApiSiteUpdateTonMagic
  | ApiSiteUpdateDeeplinkHook
  | ApiSiteDisconnect;

export type ApiLegacyDappUpdate = ApiDappUpdateBalance | ApiDappUpdateAccounts;

export type OnApiSiteUpdate = (update: ApiSiteUpdate) => void;
