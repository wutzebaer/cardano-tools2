import { components } from "@cardano/dbsync.schema";

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

export interface SimpleScript {
  type: "all" | "any" | "atLeast" | "before" | "after" | "sig";
  scripts?: SimpleScript[];
  required?: number;
  slot?: number;
  keyHash?: string;
}

export interface PolicyPrivate {
  id?: number;
  policyId: string;
  policy: string;
  address: AddressPrivate;
  policyDueSlot: number;
  name?: string;
}

export interface AddressPrivate {
  address: string;
  skey: string;
  vkey: string;
}

export type TokenListItem = components["schemas"]["TokenListItem"];
export type TokenDetails = components["schemas"]["TokenDetails"];
