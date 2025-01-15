import { Cardano, WalletConnection, WalletInfo } from "@types";

const wallets: Cardano = Object.entries(window.cardano ?? {})
  .filter(([, value]: [string, WalletInfo]) => value.apiVersion)
  .reduce((cardano, [key, value]) => {
    cardano.set(key, value);
    return cardano;
  }, new Map());

export const listWallets = (): Cardano => {
  return wallets;
};

export const connectWallet = async (key: string): Promise<WalletConnection> => {
  const wallet = wallets.get(key);
  if (!wallet) {
    throw new Error(`Wallet with key ${key} not found`);
  }
  return wallet.enable().then((wallet) => {
    localStorage.setItem("wallet", key);
    return wallet;
  });
};

export const getConnection = async (): Promise<WalletConnection> => {
  const walletInfo = window.cardano[localStorage.getItem("wallet") ?? ""];
  if (!walletInfo) {
    (document.getElementById("wallet_dialog") as HTMLFormElement).showModal();
  } else {
    return walletInfo.enable();
  }
};

export const stake = async () => {
  const poolId = "pool180fejev4xgwe2y53ky0pxvgxr3wcvkweu6feq5mdljfzcsmtg6u";
  const connection = await getConnection();
  console.log(connection);
};
