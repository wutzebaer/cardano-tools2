"use client";

import { delegateToPool } from "@cardano/transaction";
import { getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext } from "@components/StateProvider";
import Image from "next/image";
import { useCallback, useContext } from "react";

const StakeNow = () => {

  const context = useContext(ApplicationContext);

  const stake = useCallback(async () => {
    const poolId = "pool180fejev4xgwe2y53ky0pxvgxr3wcvkweu6feq5mdljfzcsmtg6u";
    const walletInfo = await getSelectedWallet(SelectionMode.ForceSelectIfNone);
    context.setState({ walletInfo: walletInfo });
    delegateToPool(await walletInfo.enable(), poolId);
  }, [context]);

  return (
    <div className="surface flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Image
          className="rounded-full"
          src="/charlien-t-sm.png"
          alt="CHIEN logo"
          width={36}
          height={42}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Stake with [CHIEN]</p>
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
