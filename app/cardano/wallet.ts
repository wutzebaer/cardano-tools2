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

export function disconnect() {
  localStorage.removeItem("wallet");
}

export async function getWalletInfo(force: true): Promise<WalletInfo>;
export async function getWalletInfo(force: boolean): Promise<WalletInfo | null>;
export async function getWalletInfo(force: boolean = false): Promise<WalletInfo | null> {
  const wallets = listWallets();
  const localStorageWallet = localStorage.getItem("wallet");
  if (localStorageWallet && (await wallets.get(localStorageWallet)?.isEnabled())) {
    return wallets.get(localStorageWallet) ?? null;
  } else if (force) {
    if (wallets.size === 1) {
      return wallets.values().next().value!;
    } else {
      const walletKey = await showReturningModal("wallet_dialog");
      return wallets.get(walletKey) ?? null;
    }
  } else {
    return null;
  }
}

export async function getConnection(force: true): Promise<WalletConnection>;
export async function getConnection(force: boolean): Promise<WalletConnection>;
export async function getConnection(force: boolean = false): Promise<WalletConnection | null> {
  const walletInfo = await getWalletInfo(force);

  if (!walletInfo) {
    return null;
  }

  localStorage.setItem("wallet", walletInfo.name);
  return walletInfo.enable().catch((error) => {
    localStorage.removeItem("wallet");
    throw error;
  });
}
