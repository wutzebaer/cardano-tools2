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
    <div className="flex flex-col items-center gap-2">
      <Image
        src="/charlien-t-sm.png"
        alt="CHIEN logo"
        width={150}
        height={175}
      />



      <button className="btn btn-ghost w-full" onClick={stake}>
        delegate to [CHIEN]
      </button>
    </div>
  );
};

export default StakeNow;
