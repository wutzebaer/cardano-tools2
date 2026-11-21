"use client";

import { hexToBytes, rewardAddressHashToBech32 } from "@cardano/transaction";
import { WalletConnection, WalletInfo } from "@cardano/types";
import { getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext } from "@components/StateProvider";
import { Address } from "@emurgo/cardano-serialization-lib-browser";
import { useCallback, useContext, useEffect, useState } from "react";

const MAINNET = 1;

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
  const connection = await info.enable();
  if ((await connection.getNetworkId()) !== MAINNET) {
    throw new Error("Please switch your wallet to mainnet");
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
  const walletInfo = context.state.walletInfo;
  const [loaded, setLoaded] = useState<ConnectedWallet | null>(null);

  useEffect(() => {
    if (!walletInfo) return;
    let cancelled = false;
    loadWallet(walletInfo).then((wallet) => {
      if (!cancelled) setLoaded(wallet);
    });
    return () => {
      cancelled = true;
    };
  }, [walletInfo]);

  const wallet = walletInfo && loaded?.info === walletInfo ? loaded : null;

  const connect = useCallback(async () => {
    const walletInfo = await getSelectedWallet(SelectionMode.ForceSelectIfNone);
    context.setState({ walletInfo });
  }, [context]);

  return { wallet, connect, connecting: Boolean(walletInfo) && !wallet };
}
