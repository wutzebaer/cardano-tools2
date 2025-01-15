"use client";
import { Cardano, WalletConnection, WalletInfo } from "@types";

export const listWallets = (): Cardano => {
  return Object.entries(window.cardano ?? {})
    .filter(([, value]: [string, WalletInfo]) => value.apiVersion)
    .reduce((cardano, [key, value]) => {
      cardano.set(key, value);
      return cardano;
    }, new Map());
};

export const connectWallet = async (key: string): Promise<WalletConnection> => {
  const wallet = listWallets().get(key);
  if (!wallet) {
    throw new Error(`Wallet with key ${key} not found`);
  }
  return wallet
    .enable()
    .then((wallet) => {
      localStorage.setItem("wallet", key);
      return wallet;
    })
    .catch((error) => {
      localStorage.removeItem("wallet");
      throw error;
    });
};

export const getConnection = async (): Promise<WalletConnection> => {
  const wallets = listWallets();

  const localStorageWallet = localStorage.getItem("wallet");
  if (localStorageWallet && wallets.has(localStorageWallet)) {
    return connectWallet(localStorageWallet);
  }

  const dialog = document.getElementById("wallet_dialog") as HTMLFormElement;
  const selected = new Promise<string>((resolve, reject) => {
    const listener = () => {
      dialog.removeEventListener("close", listener);
      if (dialog.returnValue) {
        resolve(dialog.returnValue);
      } else {
        reject(new Error("No wallet selected"));
      }
    };
    dialog.addEventListener("close", listener);
    dialog.showModal();
  });

  return connectWallet(await selected);
};

export const stake = async () => {
  const poolId = "pool180fejev4xgwe2y53ky0pxvgxr3wcvkweu6feq5mdljfzcsmtg6u";
  const connection = await getConnection();
  console.log(connection);
};
