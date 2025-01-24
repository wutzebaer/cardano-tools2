import { Cardano, WalletConnection, WalletInfo } from "@types";
import { showReturningModal } from "./dialog";

export const listWallets = (): Cardano => {
  return Object.entries(window.cardano ?? {})
    .filter(([, value]: [string, WalletInfo]) => value.apiVersion)
    .reduce((cardano, [key, value]) => {
      cardano.set(key, value);
      return cardano;
    }, new Map());
};

export async function getConnection(force: true): Promise<WalletConnection>;
export async function getConnection(force?: false): Promise<WalletConnection | void>;
export async function getConnection(force: boolean = false): Promise<WalletConnection | void> {
  const wallets = listWallets();
  let walletKey: string;

  // Check if there is a wallet stored in localStorage and if it is enabled
  const localStorageWallet = localStorage.getItem("wallet");
  if (localStorageWallet && (await wallets.get(localStorageWallet)?.isEnabled())) {
    walletKey = localStorageWallet;
  } else if (force) {
    // If force is true, check if there is only one wallet available
    if (wallets.size === 1) {
      walletKey = wallets.keys().next().value!;
    } else {
      // Show the wallet selection dialog if there are multiple wallets
      walletKey = await showReturningModal("wallet_dialog");
    }
  } else {
    // If force is false and no wallet is enabled, return without doing anything
    return;
  }

  // Store the selected wallet in localStorage and enable it
  localStorage.setItem("wallet", walletKey);
  return wallets
    .get(walletKey)!
    .enable()
    .catch((error) => {
      // Remove the wallet from localStorage if there is an error
      localStorage.removeItem("wallet");
      throw error;
    });
}
