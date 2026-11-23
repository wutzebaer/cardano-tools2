"use client";

import { POOL_TICKER } from "@cardano/pool";
import { useStakeNow } from "@components/StakeNow";
import { useStakeInfo } from "@components/useStakeInfo";
import { useWallet } from "@components/useWallet";
import { HeartIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

/**
 * Says after a finished job how the site is paid for, and offers the delegation that pays for it.
 * A wallet that already stakes with the pool is thanked instead, one whose pool is not known yet sees nothing.
 */
export default function SupportNote() {
  const { wallet } = useWallet();
  const stake = useStakeNow();
  const { delegatedHere, pending, known } = useStakeInfo();

  if (!wallet || !known) return null;

  if (delegatedHere) {
    return (
      <p className="flex items-center gap-2 text-sm text-base-content/65">
        <HeartIcon className="size-4 shrink-0 text-success" />
        Thanks for staking with [{POOL_TICKER}], that is what keeps these tools free.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-field border border-line bg-base-300/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-base-content/65">
        Cardano Tools is free and funded by the [{POOL_TICKER}] stake pool. Delegating costs you nothing, your ADA stays in your wallet, and it keeps the site running.
      </p>
      {pending ? (
        <p className="flex shrink-0 items-center gap-2 text-xs text-base-content/55">
          <span className="loading loading-spinner loading-xs" />
          Delegation submitted
        </p>
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/pool" className="text-xs text-primary hover:underline">
            About the pool
          </Link>
          <button className="btn btn-sm border-line bg-base-300 hover:border-line-strong" onClick={stake}>
            Delegate to [{POOL_TICKER}]
          </button>
        </div>
      )}
    </div>
  );
}
