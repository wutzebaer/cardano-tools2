"use server";

import { getEpochStake, getReturnAddresses } from "@cardano/dbsync";
import { TIP_STAKE_ADDRESS } from "@cardano/distribution";
import { IS_MAINNET } from "@cardano/network";

/** The API resolves at most this many stake addresses per request. */
const RETURN_ADDRESS_CHUNK = 5000;

export interface LoadedStaker {
  stakeAddress: string;
  address: string;
  /** Active stake in lovelace */
  amount: number;
}

export interface LoadedStakers {
  stakers: LoadedStaker[];
  /** Payment address of the Cardano Tools pool pledge for the optional tip */
  tipAddress?: string;
}

/** Delegators of a pool in an epoch together with the payment address their reward goes to. */
export async function loadStakers(poolHash: string, epoch: number): Promise<LoadedStakers> {
  const stakes = await getEpochStake(poolHash, epoch);
  // the pool that receives the tip only exists on mainnet
  const stakeAddresses = [...new Set([...stakes.map((stake) => stake.stakeAddress), ...(IS_MAINNET ? [TIP_STAKE_ADDRESS] : [])])];

  const returnAddresses = new Map<string, string>();
  for (let i = 0; i < stakeAddresses.length; i += RETURN_ADDRESS_CHUNK) {
    for (const { stakeAddress, address } of await getReturnAddresses(stakeAddresses.slice(i, i + RETURN_ADDRESS_CHUNK))) {
      returnAddresses.set(stakeAddress, address);
    }
  }

  const stakers = stakes.flatMap((stake) => {
    const address = returnAddresses.get(stake.stakeAddress);
    return address ? [{ stakeAddress: stake.stakeAddress, address, amount: stake.amount }] : [];
  });
  return { stakers, tipAddress: returnAddresses.get(TIP_STAKE_ADDRESS) };
}
