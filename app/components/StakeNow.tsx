"use client";

import { POOL_ID, POOL_TICKER } from "@cardano/pool";
import { delegateToPool } from "@cardano/transaction";
import { enableWallet, getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext } from "@components/StateProvider";
import Image from "next/image";
import { useCallback, useContext } from "react";

/** Delegates the connected wallet to the Cardano Tools pool. */
export function useStakeNow() {
  const context = useContext(ApplicationContext);

  return useCallback(async () => {
    const walletInfo = await getSelectedWallet(SelectionMode.ForceSelectIfNone);
    context.setState({ walletInfo: walletInfo });
    return delegateToPool(await enableWallet(walletInfo), POOL_ID);
  }, [context]);
}

const StakeNow = () => {
  const stake = useStakeNow();

  return (
    <div className="surface flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Image className="rounded-full" src="/images/cardano-tools-pool.png" alt="" width={36} height={36} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Stake with [{POOL_TICKER}]</p>
          <p className="text-xs text-base-content/55">Support Cardano Tools</p>
        </div>
      </div>
      <button className="btn btn-sm w-full border-line bg-base-300 hover:border-line-strong hover:bg-base-300" onClick={stake}>
        Delegate
      </button>
    </div>
  );
};

export default StakeNow;
