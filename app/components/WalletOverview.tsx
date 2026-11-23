"use client";

import { rewardAddressHashToBech32 } from "@cardano/transaction";
import { WalletInfo } from "@cardano/types";
import { formatAda } from "@cardano/utils";
import { getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext } from "@components/StateProvider";
import { Value } from "@emurgo/cardano-serialization-lib-browser";
import Image from "next/image";
import { useContext, useEffect, useState } from "react";

interface WalletStats {
  name: string;
  icon: string;
  balance: number;
  changeAddress: string;
  rewardAddresses: string[];
}

function WalletOverview() {

  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);
  const context = useContext(ApplicationContext);

  const updateWalletStats = async (fetchedWalletInfo: WalletInfo | null) => {
    if (!fetchedWalletInfo) {
      setWalletStats(null);
    } else {
      const connection = await fetchedWalletInfo.enable();
      const name = fetchedWalletInfo.name;
      const icon = fetchedWalletInfo.icon;
      const balanceCBORHex = await connection.getBalance();
      const balanceBigNum = Value.from_bytes(
        Buffer.from(balanceCBORHex, 'hex')
      ).coin();
      const balance = Number(balanceBigNum.to_str());
      const changeAddress = await connection.getChangeAddress();
      const rewardAddresses = await connection.getRewardAddresses();
      setWalletStats({ name, icon, balance, changeAddress, rewardAddresses });
    }
  };

  // Update when context chnages
  useEffect(() => {
    (async () => {
      updateWalletStats(context.state.walletInfo);
    })();
  }, [context.state.walletInfo]);

  // Once on load: reconnect the wallet chosen on an earlier visit.
  // Must not depend on the context and must not set state without a wallet, both would re-render in an endless loop.
  const { setState } = context;
  useEffect(() => {
    getSelectedWallet(SelectionMode.IfSelected).then((fetchedWalletInfo) => {
      if (fetchedWalletInfo) setState({ walletInfo: fetchedWalletInfo });
    });
  }, [setState]);

  const reconnect = async () => {
    context.setState({ walletInfo: null });
    getSelectedWallet(SelectionMode.ForceSelection).then(fetchedWalletInfo => {
      context.setState({ walletInfo: fetchedWalletInfo });
    });
  }

  const [balanceInt, balanceFraction] = walletStats ? formatAda(walletStats.balance).split(".") : [];

  return (
    <>
      {walletStats ? (
        <div className="surface flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs text-base-content/55">
              <Image
                width={18}
                height={18}
                src={walletStats.icon}
                alt={`${walletStats.name} logo`}
                className="size-[18px]"
                unoptimized
              />
              {walletStats.name}
            </span>
            <button className="text-xs text-primary hover:underline" onClick={reconnect}>Switch</button>
          </div>
          <div className="tabular-nums">
            <span className="text-2xl font-semibold tracking-tight">{balanceInt}</span>
            <span className="align-top text-sm text-base-content/55">.{balanceFraction}</span>
          </div>
          <p className="truncate font-mono text-[11px] text-base-content/45">
            {rewardAddressHashToBech32(walletStats.rewardAddresses[0])}
          </p>
        </div>
      ) : (
        <button className="btn btn-primary w-full" onClick={reconnect}>
          Connect wallet
        </button>
      )}
    </>
  )
}


export default WalletOverview
