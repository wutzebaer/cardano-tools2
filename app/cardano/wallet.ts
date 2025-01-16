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

export const getConnection = async (): Promise<WalletConnection> => {
  const wallets = listWallets();
  let walletKey: Promise<string>;

  const localStorageWallet = localStorage.getItem("wallet");
  if (localStorageWallet && wallets.has(localStorageWallet)) {
    walletKey = Promise.resolve(localStorageWallet);
  } else {
    walletKey = showReturningModal("wallet_dialog");
  }

  return walletKey
    .then((key) => {
      localStorage.setItem("wallet", key);
      return wallets.get(key)!.enable();
    })
    .catch((error) => {
      localStorage.removeItem("wallet");
      throw error;
    });
};

export const stake = async () => {
  const poolId = "pool180fejev4xgwe2y53ky0pxvgxr3wcvkweu6feq5mdljfzcsmtg6u";
  const connection = await getConnection();
  console.log(connection);
};
