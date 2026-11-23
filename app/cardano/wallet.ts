import { Cardano, WalletConnection, WalletInfo } from "@cardano/types";
import { showReturningModal } from "./dialog";

export const EMPTY_WALLETS: Cardano = new Map();

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
  const localStorageWalletKey = localStorage.getItem("walletKey");

  if (selectionMode === SelectionMode.ForceSelection) {
    localStorage.removeItem("walletKey");
    const walletKey = await showReturningModal("wallet_dialog");
    localStorage.setItem("walletKey", walletKey);
    return wallets.get(walletKey)!;
  }
  else if (selectionMode === SelectionMode.ForceSelectIfNone) {
    if (localStorageWalletKey && wallets.has(localStorageWalletKey)) {
      return wallets.get(localStorageWalletKey)!;
    } else {
      const walletKey = await showReturningModal("wallet_dialog");
      localStorage.setItem("walletKey", walletKey);
      return wallets.get(walletKey)!;
    }
  } else if (selectionMode === SelectionMode.IfSelected) {
    if (localStorageWalletKey && wallets.has(localStorageWalletKey)) {
      return wallets.get(localStorageWalletKey)!;
    }
  }
  return null;
}

const connections = new WeakMap<WalletInfo, Promise<WalletConnection>>();

/**
 * Asks the wallet for access once, however many parts of the page need the connection at the same time.
 * Wallets such as Eternl cancel a pending request when a second one arrives. A refused request is asked again next time.
 */
export function enableWallet(info: WalletInfo): Promise<WalletConnection> {
  let connection = connections.get(info);
  if (!connection) {
    connection = info.enable();
    connections.set(info, connection);
    connection.catch(() => connections.delete(info));
  }
  return connection;
}
