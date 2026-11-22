"use client";

import { getStakeInfo } from "@cardano/dbsync";
import { POOL_ID, POOL_TICKER } from "@cardano/pool";
import { StakeInfo } from "@cardano/types";
import { formatAda } from "@cardano/utils";
import { useStakeNow } from "@components/StakeNow";
import TxResult from "@components/TxResult";
import { useWallet } from "@components/useWallet";
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
    <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-base-content/65">
        {delegatedHere
          ? `Thank you! Your wallet stakes ${formatAda(info?.stake)} with [${POOL_TICKER}].`
          : info?.poolHash
            ? `Your wallet currently stakes ${formatAda(info.stake)} with [${info.tickerName ?? "another pool"}]. Delegating is one transaction, your ADA never leaves your wallet.`
            : "Delegating is one transaction, your ADA never leaves your wallet and stays spendable."}
      </p>
      {delegatedHere ? null : (
        <button className="btn btn-primary shrink-0" onClick={async () => setTxHash(await stake())}>
          Delegate to [{POOL_TICKER}]
        </button>
      )}
    </div>
  );
}
