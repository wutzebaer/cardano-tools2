/** Pure reward maths, no wallet or serialization library involved. */

export const ONE_ADA = 1_000_000n;

/** Stake address of the Cardano Tools pool pledge, receives the optional tip. */
export const TIP_STAKE_ADDRESS = "stake1u9k8maputfwef7kjl6nvguupxcvllplpa967amss06fxwngzsj30w";

export interface RewardToken {
  policyId: string;
  /** Asset name as hex */
  name: string;
  amount: bigint;
}

export interface RewardFunds {
  lovelace: bigint;
  tokens: RewardToken[];
}

export interface Staker {
  stakeAddress: string;
  /** Payment address the reward is sent to */
  address: string;
  /** Active stake in lovelace */
  amount: bigint;
}

export interface RewardPosition {
  stakeAddress: string;
  address: string;
  stake: bigint;
  /** Fraction of the distributed stake, 0..1 */
  share: number;
  lovelace: bigint;
  /** Token amounts keyed by `policyId.assetNameHex` */
  tokens: Map<string, bigint>;
  tip?: boolean;
}

export class NotEnoughFundsError extends Error {
  /** Lovelace that would be needed in total */
  required: bigint;

  constructor(required: bigint) {
    super("Not enough ADA to give every staker the minimum output");
    this.required = required;
  }
}

/**
 * Splits the funds between stakers proportionally to their stake.
 * Every output has to carry a minimum of ADA, so that is handed out first and only the rest is shared by stake.
 * Token units left over by rounding go to the stakers with the largest fractions; the ADA remainder goes to the tip, or the largest staker.
 */
export function distribute(
  stakers: Staker[],
  funds: RewardFunds,
  tipAddress: string | undefined,
  minLovelace: (address: string, tokens: Map<string, bigint>) => bigint
): RewardPosition[] {
  const sorted = [...stakers].sort((a, b) => (a.amount === b.amount ? 0 : a.amount < b.amount ? 1 : -1));
  const totalStake = sorted.reduce((sum, staker) => sum + staker.amount, 0n);
  if (sorted.length === 0 || totalStake === 0n) {
    return [];
  }

  const positions: RewardPosition[] = sorted.map((staker) => ({
    stakeAddress: staker.stakeAddress,
    address: staker.address,
    stake: staker.amount,
    share: Number(staker.amount) / Number(totalStake),
    lovelace: 0n,
    tokens: new Map(),
  }));

  for (const token of funds.tokens) {
    const key = `${token.policyId}.${token.name}`;
    // largest remainder method: everyone gets the rounded down share, the units left over go to the largest fractions
    const shares = positions.map((position) => ({ position, amount: (token.amount * position.stake) / totalStake, fraction: (token.amount * position.stake) % totalStake }));
    let remainder = token.amount - shares.reduce((sum, share) => sum + share.amount, 0n);
    for (const share of [...shares].sort((a, b) => (a.fraction === b.fraction ? 0 : a.fraction < b.fraction ? 1 : -1))) {
      if (remainder === 0n) break;
      share.amount += 1n;
      remainder -= 1n;
    }
    for (const { position, amount } of shares) {
      if (amount > 0n) {
        position.tokens.set(key, amount);
      }
    }
  }

  const tip = tipAddress ? ONE_ADA : 0n;
  let available = funds.lovelace - tip;
  for (const position of positions) {
    const minimum = minLovelace(position.address, position.tokens);
    position.lovelace = minimum > ONE_ADA ? minimum : ONE_ADA;
    available -= position.lovelace;
  }
  if (available < 0n) {
    throw new NotEnoughFundsError(funds.lovelace - available);
  }

  let leftover = available;
  for (const position of positions) {
    const additional = (available * position.stake) / totalStake;
    position.lovelace += additional;
    leftover -= additional;
  }

  if (tipAddress) {
    positions.push({ stakeAddress: TIP_STAKE_ADDRESS, address: tipAddress, stake: 0n, share: 0, lovelace: tip + leftover, tokens: new Map(), tip: true });
  } else {
    positions[0].lovelace += leftover;
  }
  return positions;
}
