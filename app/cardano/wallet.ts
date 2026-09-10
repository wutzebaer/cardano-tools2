import { Cardano, WalletInfo } from "@cardano/types";
import { useSyncExternalStore } from "react";
import { showReturningModal } from "./dialog";

const EMPTY_WALLETS: Cardano = new Map();
let walletsSnapshot: Cardano = EMPTY_WALLETS;
let walletsSnapshotKey = "";

export const listWallets = (): Cardano => {
  if (typeof window === "undefined") {
    return EMPTY_WALLETS;
  }
  return Object.entries(window.cardano ?? {})
    .filter(([, value]: [string, WalletInfo]) => value.apiVersion)
    .reduce((cardano, [key, value]) => {
      cardano.set(key, value);
      return cardano;
    }, new Map());
};

function getWalletsSnapshot(): Cardano {
  const wallets = listWallets();
  const key = [...wallets.keys()].join(",");
  if (key !== walletsSnapshotKey) {
    walletsSnapshotKey = key;
    walletsSnapshot = wallets;
  }
  return walletsSnapshot;
}

function subscribeWallets() {
  return () => {};
}

export function useWallets(): Cardano {
  return useSyncExternalStore(subscribeWallets, getWalletsSnapshot, () => EMPTY_WALLETS);
}

export enum SelectionMode {
  ForceSelection,
  ForceSelectIfNone,
  IfSelected,
}

export async function getSelectedWallet(selectionMode: SelectionMode.ForceSelection): Promise<WalletInfo>;
export async function getSelectedWallet(selectionMode: SelectionMode.ForceSelectIfNone): Promise<WalletInfo>;
export async function getSelectedWallet(selectionMode: SelectionMode.IfSelected): Promise<WalletInfo | null>;
export async function getSelectedWallet(selectionMode: SelectionMode = SelectionMode.IfSelected): Promise<WalletInfo | null> {
  const wallets = listWallets();
  const localStorageWallet = localStorage.getItem("wallet");
  if (localStorageWallet && (await wallets.get(localStorageWallet)?.isEnabled()) && selectionMode !== SelectionMode.ForceSelection) {
    return wallets.get(localStorageWallet) ?? null;
  } else if (selectionMode !== SelectionMode.IfSelected) {
    if (wallets.size === 1) {
      localStorage.setItem("wallet", wallets.keys().next().value!);
      return wallets.values().next().value!;
    } else {
      const walletKey = await showReturningModal("wallet_dialog");
      localStorage.setItem("wallet", walletKey);
      return wallets.get(walletKey) ?? null;
    }
  } else {
    return null;
  }
}
