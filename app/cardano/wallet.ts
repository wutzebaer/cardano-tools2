import { Cardano, WalletConnection, WalletInfo } from "@types";
import { showReturningModal } from "./dialog";
import { Address } from "@emurgo/cardano-serialization-lib-browser";

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
  const stakeAddressHash = (await connection.getRewardAddresses())[0];

  const address = Address.from_bytes(Buffer.from(stakeAddressHash, "hex"));
  console.log(address);

  // Delegation certificate
  //const delegationCert = Certificate.new_stake_delegation(
  //StakeDelegation.new(stakeCredential, Ed25519KeyHash.from_bech32(poolId))
  //);
};
