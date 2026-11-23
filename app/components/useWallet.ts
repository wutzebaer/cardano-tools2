"use client";

import { NETWORK } from "@cardano/network";
import { hexToBytes, rewardAddressHashToBech32 } from "@cardano/transaction";
import { WalletConnection, WalletInfo } from "@cardano/types";
import { enableWallet, getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext, ApplicationState } from "@components/StateProvider";
import { Address } from "@emurgo/cardano-serialization-lib-browser";
import { useCallback, useContext, useEffect, useState } from "react";

export interface ConnectedWallet {
  info: WalletInfo;
  connection: WalletConnection;
  /** Bech32 change address */
  changeAddress: string;
  /** Payment key hash of the change address */
  keyHash: string;
  /** Payment key hashes of all addresses the wallet reports, the wallet can sign for any of them */
  keyHashes: string[];
  stakeAddress: string;
}

function paymentKeyHash(addressHex: string) {
  try {
    return Address.from_bytes(hexToBytes(addressHex)).payment_cred()?.to_keyhash()?.to_hex();
  } catch {
    return undefined;
  }
}

async function loadWallet(info: WalletInfo): Promise<ConnectedWallet> {
  const connection = await enableWallet(info);
  if ((await connection.getNetworkId()) !== NETWORK.id) {
    throw new Error(`Please switch your wallet to ${NETWORK.name}`);
  }
  const [changeAddressHex, rewardAddresses, usedAddresses, unusedAddresses] = await Promise.all([
    connection.getChangeAddress(),
    connection.getRewardAddresses(),
    connection.getUsedAddresses().catch(() => []),
    connection.getUnusedAddresses().catch(() => []),
  ]);
  const keyHash = paymentKeyHash(changeAddressHex);
  if (!keyHash) {
    throw new Error("The wallet's change address has no payment key");
  }
  const keyHashes = new Set([keyHash]);
  for (const address of [...(usedAddresses ?? []), ...(unusedAddresses ?? [])]) {
    const hash = paymentKeyHash(address);
    if (hash) keyHashes.add(hash);
  }
  return {
    info,
    connection,
    changeAddress: Address.from_bytes(hexToBytes(changeAddressHex)).to_bech32(),
    keyHash,
    keyHashes: [...keyHashes],
    stakeAddress: rewardAddressHashToBech32(rewardAddresses[0]),
  };
}

/** The connected wallet with its addresses and keys, or null while none is connected or it is still loading. */
export function useWallet() {
  const context = useContext(ApplicationContext);
  // every selection creates a new state object, also when the same wallet is selected again after "Switch"
  const state = context.state;
  const walletInfo = state.walletInfo;
  const [loaded, setLoaded] = useState<{ state: ApplicationState; wallet: ConnectedWallet } | null>(null);

  useEffect(() => {
    const walletInfo = state.walletInfo;
    if (!walletInfo) return;
    let cancelled = false;
    // a refused connection is reported and reset by the wallet overview, which asks for the same connection
    enableWallet(walletInfo).then(
      () =>
        loadWallet(walletInfo).then((wallet) => {
          if (!cancelled) setLoaded({ state, wallet });
        }),
      () => undefined
    );
    return () => {
      cancelled = true;
    };
  }, [state]);

  // a wallet loaded for an earlier selection is stale: the account inside the wallet may be another one now
  const wallet = walletInfo && loaded?.state === state ? loaded.wallet : null;

  const connect = useCallback(async () => {
    const walletInfo = await getSelectedWallet(SelectionMode.ForceSelectIfNone);
    context.setState({ walletInfo });
  }, [context]);

  return { wallet, connect, connecting: Boolean(walletInfo) && !wallet };
}
