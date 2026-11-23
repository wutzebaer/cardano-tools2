"use client";

import { POOL_TICKER } from "@cardano/pool";
import { formatAda } from "@cardano/utils";
import { useStakeNow } from "@components/StakeNow";
import TxResult from "@components/TxResult";
import { useStakeInfo } from "@components/useStakeInfo";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

/** Shows where the connected wallet is delegated and lets it delegate to the Cardano Tools pool. */
export default function PoolStake() {
  const stake = useStakeNow();
  const { info, delegatedHere } = useStakeInfo();
  const [txHash, setTxHash] = useState<string | null>(null);

  if (txHash) {
    return <TxResult title="Delegation submitted" txHashes={[txHash]} onReset={() => setTxHash(null)} resetLabel="Done" />;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {delegatedHere ? (
        <p className="flex items-center gap-2 rounded-field border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckBadgeIcon className="size-5 shrink-0" />
          Thank you! Your wallet stakes {formatAda(info?.stake)} with [{POOL_TICKER}]{info?.poolRewards ? `, and the pool has earned ${formatAda(info.poolRewards)} in rewards for you so far` : ""}.
        </p>
      ) : (
        <>
          <button className="btn btn-primary btn-lg px-8 shadow-lg shadow-primary/30" onClick={async () => setTxHash(await stake())}>
            Delegate to [{POOL_TICKER}]
          </button>
          <p className="text-xs text-white/55">
            {info?.poolHash
              ? `Your wallet currently stakes ${formatAda(info.stake)} with [${info.tickerName ?? "another pool"}]. Switching is one transaction.`
              : "One transaction from your own wallet. Your ADA never leaves it."}
          </p>
        </>
      )}
    </div>
  );
}
