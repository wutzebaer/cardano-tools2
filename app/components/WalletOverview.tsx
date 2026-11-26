"use client";

import { rewardAddressHashToBech32, WALLET_CHANGED } from "@cardano/transaction";
import { WalletInfo } from "@cardano/types";
import { formatAda } from "@cardano/utils";
import { enableWallet, getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext } from "@components/StateProvider";
import { useHandle } from "@components/useHandles";
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

  const { setState } = context;
  const connectedWallet = context.state.walletInfo;

  // Reads the wallet again whenever another one is selected
  useEffect(() => {
    const updateWalletStats = async (fetchedWalletInfo: WalletInfo | null) => {
      if (!fetchedWalletInfo) {
        setWalletStats(null);
      } else {
        const connection = await enableWallet(fetchedWalletInfo).catch((error) => {
          // refused or closed: back to "Connect wallet" instead of waiting forever, and no new request on the next visit
          localStorage.removeItem("walletKey");
          setState({ walletInfo: null });
          throw error;
        });
        const name = fetchedWalletInfo.name;
        const icon = fetchedWalletInfo.icon;
        try {
          const balanceCBORHex = await connection.getBalance();
          const balanceBigNum = Value.from_bytes(Buffer.from(balanceCBORHex, "hex")).coin();
          const balance = Number(balanceBigNum.to_str());
          const changeAddress = await connection.getChangeAddress();
          const rewardAddresses = await connection.getRewardAddresses();
          setWalletStats({ name, icon, balance, changeAddress, rewardAddresses });
        } catch (error) {
          // the wallet does not answer: back to "Connect wallet" instead of "Connecting" forever
          setState({ walletInfo: null });
          throw error;
        }
      }
    };
    updateWalletStats(connectedWallet);
  }, [connectedWallet, setState]);

  // A confirmed transaction of this page changed the balance, which is read again without touching the rest
  useEffect(() => {
    if (!connectedWallet) return;
    const refresh = async () => {
      try {
        const connection = await enableWallet(connectedWallet);
        const balance = Number(
          Value.from_bytes(Buffer.from(await connection.getBalance(), "hex"))
            .coin()
            .to_str()
        );
        setWalletStats((stats) => (stats ? { ...stats, balance } : stats));
      } catch {
        // the balance shown stays until the next reading
      }
    };
    window.addEventListener(WALLET_CHANGED, refresh);
    return () => window.removeEventListener(WALLET_CHANGED, refresh);
  }, [connectedWallet]);

  // Once on load: reconnect the wallet chosen on an earlier visit.
  // Must not depend on the context and must not set state without a wallet, both would re-render in an endless loop.
  // An extension that was asleep adds itself to the page a moment after it has loaded, so a remembered wallet
  // that is not there yet is looked for again for a few seconds.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let triesLeft = 25;
    const attempt = () =>
      getSelectedWallet(SelectionMode.IfSelected).then((fetchedWalletInfo) => {
        if (cancelled) return;
        if (fetchedWalletInfo) setState({ walletInfo: fetchedWalletInfo });
        else if (localStorage.getItem("walletKey") && triesLeft-- > 0) timer = setTimeout(attempt, 200);
      });
    attempt();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setState]);

  const reconnect = async () => {
    context.setState({ walletInfo: null });
    getSelectedWallet(SelectionMode.ForceSelection).then((fetchedWalletInfo) => {
      context.setState({ walletInfo: fetchedWalletInfo });
    });
  };

  const stakeAddress = walletStats ? rewardAddressHashToBech32(walletStats.rewardAddresses[0]) : undefined;
  const handle = useHandle(stakeAddress);

  const [balanceInt, balanceFraction] = walletStats ? formatAda(walletStats.balance).split(".") : [];

  return (
    <>
      {walletStats ? (
        <div className="surface flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-xs text-base-content/55">
              <Image width={18} height={18} src={walletStats.icon} alt={`${walletStats.name} logo`} className="size-[18px]" unoptimized />
              {walletStats.name}
            </span>
            <button className="text-xs text-primary hover:underline" onClick={reconnect}>
              Switch
            </button>
          </div>
          <div className="tabular-nums">
            <span className="text-brand inline-block text-2xl font-semibold tracking-tight">{balanceInt}</span>
            <span className="align-top text-sm text-base-content/55">.{balanceFraction}</span>
          </div>
          <p className={`truncate ${handle ? "text-xs font-medium text-base-content/70" : "font-mono text-[11px] text-base-content/45"}`} title={stakeAddress}>
            {handle ?? stakeAddress}
          </p>
        </div>
      ) : context.state.walletInfo ? (
        <button className="btn btn-primary w-full" disabled>
          <span className="loading loading-spinner loading-sm" />
          Connecting…
        </button>
      ) : (
        <button className="btn btn-primary w-full" onClick={reconnect}>
          Connect wallet
        </button>
      )}
    </>
  );
}

export default WalletOverview;
