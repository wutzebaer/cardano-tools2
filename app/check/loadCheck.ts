import { getAddressByHandle, getPoolAlternatives, getPoolCheck, getPoolPerformance, getStakeAddress, getStakeCheck } from "@cardano/dbsync";
import { POOL_ID } from "@cardano/pool";
import { Finding, pickAlternatives, poolFindings, suggestsAlternatives } from "./checkLogic";

type StakeCheck = NonNullable<Awaited<ReturnType<typeof getStakeCheck>>>;
export type PoolCheck = NonNullable<Awaited<ReturnType<typeof getPoolCheck>>>;
export type PoolPerformance = NonNullable<Awaited<ReturnType<typeof getPoolPerformance>>>;

export interface PoolOption {
  pool: PoolCheck;
  performance: PoolPerformance | null;
}

export interface CheckData {
  /** What was asked for, a `$handle` keeps its name */
  label: string;
  stakeAddress: string;
  /** Null for a stake address the chain has never seen */
  check: StakeCheck | null;
  performance: PoolPerformance | null;
  findings: Finding[];
  /** Pools to move to, filled when the address is not staking or its pool calls for a decision */
  alternatives: PoolOption[];
}

/** Stake address behind a stake address, payment address or `$handle`. */
export async function resolveStakeAddress(input: string): Promise<{ stakeAddress?: string; error?: string }> {
  const value = input.trim();
  if (value.startsWith("$")) {
    const resolved = await getAddressByHandle(value.slice(1).toLowerCase()).catch(() => null);
    if (!resolved?.address) return { error: `The handle ${value} was not found.` };
    return resolved.address.startsWith("stake") ? { stakeAddress: resolved.address } : { error: `The address behind ${value} has no stake key, so it cannot be staked.` };
  }
  if (/^stake(_test)?1[0-9a-z]{50,}$/.test(value)) return { stakeAddress: value };
  if (/^addr(_test)?1[0-9a-z]{50,}$/.test(value)) {
    const stakeAddress = await getStakeAddress(value);
    return stakeAddress?.startsWith("stake") ? { stakeAddress } : { error: "This address has no stake key or has never been used, so there is nothing to check." };
  }
  return { error: "Enter a stake address (stake1…), a payment address (addr1…) or a $handle." };
}

/** Everything the check page shows for one address. */
export async function loadCheck(input: string): Promise<CheckData | { error: string }> {
  const { stakeAddress, error } = await resolveStakeAddress(input);
  if (!stakeAddress) return { error: error ?? "Address not found." };

  const check = await getStakeCheck(stakeAddress);
  const pool = check?.pool ?? null;
  const performance = pool ? await getPoolPerformance(pool.poolHash) : null;
  const findings = pool && check ? poolFindings(pool, performance, check.currentEpoch) : [];

  let alternatives: PoolOption[] = [];
  if (!pool || suggestsAlternatives(findings)) {
    const [candidates, own] = await Promise.all([getPoolAlternatives(), getPoolCheck(POOL_ID)]);
    const picked = pickAlternatives(candidates, pool?.poolHash, own, stakeAddress);
    alternatives = await Promise.all(picked.map(async (option) => ({ pool: option, performance: await getPoolPerformance(option.poolHash) })));
  }

  return { label: input.trim().startsWith("$") ? input.trim().toLowerCase() : stakeAddress, stakeAddress, check, performance, findings, alternatives };
}
