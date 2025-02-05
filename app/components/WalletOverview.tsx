"use client";

import { rewardAddressHashToBech32 } from "@cardano/transaction";
import { formatAda } from "@cardano/utils";
import { getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext } from "@components/StateProvider";
import { Value } from "@emurgo/cardano-serialization-lib-browser";
import { WalletInfo } from "@cardano/types";
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

  // Initial fetch
  useEffect(() => {
    (async () => {
      if (!context.state.walletInfo) {
        const fetchedWalletInfo = await getSelectedWallet(SelectionMode.IfSelected);
        if (fetchedWalletInfo) {
          context.setState({ walletInfo: fetchedWalletInfo });
        }
      }
    })();
  }, [context]);

  const reconnect = async () => {
    const fetchedWalletInfo = await getSelectedWallet(SelectionMode.ForceSelection);
    context.setState({ walletInfo: fetchedWalletInfo });
  }


  /* flex items-center justify-center gap-1 font-[family-name:var(--font-geist-mono)] */
  return (
    <>
      {walletStats ? (
        <div className="stats shadow w-full">
          <div className="stat">
            <div className="stat-figure text-primary">
              <img
                width="30"
                height="30"
                src={walletStats.icon}
                alt="{walletStats.name} logo"
              />
            </div>
            <div className="stat-title"><button className="btn btn-xs btn-link p-0" onClick={reconnect}>switch wallet</button></div>
            <div className="stat-value text-2xl">
              {formatAda(walletStats.balance)}</div>
            <div className="stat-desc overflow-hidden text-ellipsis">{rewardAddressHashToBech32(walletStats.rewardAddresses[0])}</div>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost w-full" onClick={reconnect}>
          Connect wallet
        </button>
      )}
    </>
  )
}


export default WalletOverview
