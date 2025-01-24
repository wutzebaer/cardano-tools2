"use client";

import { rewardAddressHashToBech32 } from "@cardano/transaction";
import { formatAda } from "@cardano/utils";
import { disconnect, getWalletInfo } from "@cardano/wallet";
import { Value } from "@emurgo/cardano-serialization-lib-browser";
import { WalletInfo } from "@types";
import { useEffect, useState } from "react";

interface WalletStats {
  name: string;
  icon: string;
  balance: number;
  changeAddress: string;
  rewardAddresses: string[];
}

function WalletOverview() {

  const [walletStats, setWalletStats] = useState<WalletStats | null>(null);

  const updateWalletStats = async (fetchedWalletInfo: WalletInfo) => {
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

  // Get wallet info
  useEffect(() => {
    (async () => {
      const fetchedWalletInfo = await getWalletInfo(false);
      if (fetchedWalletInfo) {
        updateWalletStats(fetchedWalletInfo);
      }
    })();
  }, []);

  const connect = async () => {
    const fetchedWalletInfo = await getWalletInfo(true);
    updateWalletStats(fetchedWalletInfo);
  }

  const switchWallet = async () => {
    disconnect();
    setWalletStats(null);
    const fetchedWalletInfo = await getWalletInfo(true);
    updateWalletStats(fetchedWalletInfo);
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
            <div className="stat-title"><button className="btn btn-xs btn-link p-0" onClick={switchWallet}>switch wallet</button></div>
            <div className="stat-value text-2xl">
              {formatAda(walletStats.balance)}</div>
            <div className="stat-desc overflow-hidden text-ellipsis">{rewardAddressHashToBech32(walletStats.rewardAddresses[0])}</div>
          </div>
        </div>
      ) : (
        <button className="btn btn-ghost w-full" onClick={connect}>
          Connect wallet
        </button>
      )}
    </>
  )
}


export default WalletOverview
