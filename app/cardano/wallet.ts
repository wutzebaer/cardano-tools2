import { Cardano, WalletConnection, WalletInfo } from "@types";
import { showReturningModal } from "./dialog";

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", function (event) {
    // Standardverhalten verhindern
    event.preventDefault();

    // Eigene Logik
    console.log("Eigenes Handling: Unhandled Promise Rejection:", event.reason);

    // Optional: Promise-Referenz anzeigen
    console.log("Betroffenes Promise:", event.promise);
  });
}

export const listWallets = (): Cardano => {
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
