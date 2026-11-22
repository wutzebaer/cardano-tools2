"use client";

import { getStakeInfo } from "@cardano/dbsync";
import { POOL_ID, POOL_TICKER } from "@cardano/pool";
import { StakeInfo } from "@cardano/types";
import { formatAda } from "@cardano/utils";
import { useStakeNow } from "@components/StakeNow";
import TxResult from "@components/TxResult";
import { useWallet } from "@components/useWallet";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";

/** Shows where the connected wallet is delegated and lets it delegate to the Cardano Tools pool. */
export default function PoolStake() {
  const { wallet } = useWallet();
  const stake = useStakeNow();
  const [loaded, setLoaded] = useState<{ stakeAddress: string; info: StakeInfo | null } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const stakeAddress = wallet?.stakeAddress;

  useEffect(() => {
    if (!stakeAddress) return;
    let cancelled = false;
    getStakeInfo(stakeAddress)
      // an address that never delegated has no stake info
      .catch(() => null)
      .then((info) => {
        if (!cancelled) setLoaded({ stakeAddress, info: info ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [stakeAddress]);

  const info = loaded?.stakeAddress === stakeAddress ? loaded?.info : null;
  const delegatedHere = info?.poolHash === POOL_ID;

  if (txHash) {
    return <TxResult title="Delegation submitted" txHashes={[txHash]} onReset={() => setTxHash(null)} resetLabel="Done" />;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {delegatedHere ? (
        <p className="flex items-center gap-2 rounded-field border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckBadgeIcon className="size-5 shrink-0" />
          Thank you! Your wallet stakes {formatAda(info?.stake)} with [{POOL_TICKER}].
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
