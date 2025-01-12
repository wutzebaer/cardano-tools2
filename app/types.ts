export type Cardano = Map<string, WalletInfo>;

export interface WalletInfo {
  apiVersion: string;
  name: string;
  icon: string;
  isEnabled: () => Promise<boolean>;
  enable: () => Promise<WalletConnection>;
}

export interface WalletConnection {
  getBalance: () => Promise<string>;
  getChangeAddress: () => Promise<string>;
  getRewardAddresses: () => Promise<string[]>;
  getUtxos: () => Promise<string[]>;
  getCollateral: () => Promise<string[]>;
  signTx: (cbor: string, partialSign: boolean) => Promise<string>;
  submitTx: (cbor: string) => Promise<string>;
}
