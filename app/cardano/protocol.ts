/**
 * The protocol parameters a transaction is built with, no wallet or serialization library involved.
 *
 * They change by a vote of the chain's governance. A transaction built with old values pays too little and is
 * refused, or pays too much. So the site asks the chain for them, and the values below, which were in force when
 * this was written, stand in until it has answered and wherever the answer is missing or makes no sense.
 */
export interface ProtocolParams {
  /** Lovelace per byte of a transaction, and the lovelace every transaction costs on top */
  minFeeA: number;
  minFeeB: number;
  /** Deposit for registering a stake key, in lovelace */
  keyDeposit: number;
  poolDeposit: number;
  /** Lovelace an output has to hold per byte of its size */
  coinsPerUtxoByte: number;
  /** Bytes a transaction may have, and the value of one output */
  maxTxSize: number;
  maxValueSize: number;
  /** Lovelace per unit of memory and per step a script run may use */
  priceMem: number;
  priceStep: number;
  /** What all script runs of one transaction may use together */
  maxTxExMem: number;
  maxTxExSteps: number;
  /** Lovelace per byte of a script a transaction refers to */
  minFeeRefScriptCostPerByte: number;
  /** Collateral in percent of the fee, and how many outputs may put it up */
  collateralPercent: number;
  maxCollateralInputs: number;
}

export const DEFAULT_PROTOCOL_PARAMS: ProtocolParams = {
  minFeeA: 44,
  minFeeB: 155381,
  keyDeposit: 2_000_000,
  poolDeposit: 500_000_000,
  coinsPerUtxoByte: 4310,
  maxTxSize: 16384,
  maxValueSize: 5000,
  priceMem: 0.0577,
  priceStep: 0.0000721,
  maxTxExMem: 14_000_000,
  maxTxExSteps: 10_000_000_000,
  minFeeRefScriptCostPerByte: 15,
  collateralPercent: 150,
  maxCollateralInputs: 3,
};

/** A value further off than this from the one known here is taken for a mistake of the source, not for a vote. */
const PLAUSIBLE_FACTOR = 20;

/**
 * The parameters from what the API answered. Every value is checked on its own: one that is missing, no positive
 * number or far off keeps the value known here, so a broken answer cannot make the site build absurd transactions.
 */
export function protocolParamsFrom(answer: unknown, known: ProtocolParams = DEFAULT_PROTOCOL_PARAMS): ProtocolParams {
  const given = answer != null && typeof answer === "object" ? (answer as Record<string, unknown>) : {};
  const params = { ...known };
  for (const name of Object.keys(known) as (keyof ProtocolParams)[]) {
    const value = given[name];
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= known[name] * PLAUSIBLE_FACTOR && value >= known[name] / PLAUSIBLE_FACTOR) {
      params[name] = value;
    }
  }
  return params;
}

/** A price like 0.0577 as the fraction the chain means by it: 577 / 10000. */
export function fraction(value: number): [bigint, bigint] {
  // twelve places are more than any price has, and the zeros at the end are cut again
  const [whole, places = ""] = value.toFixed(12).replace(/0+$/, "").split(".");
  return [BigInt(whole + places), 10n ** BigInt(places.length)];
}

/** What a transaction of the largest size costs before its scripts run, in lovelace. */
export const largestSizeFee = (params: ProtocolParams) => params.minFeeB + params.minFeeA * params.maxTxSize;

/** What script runs with these budgets cost at most, in lovelace. */
export const scriptFee = (params: ProtocolParams, budgets: { mem: number; steps: number }[]) =>
  budgets.reduce((sum, budget) => sum + budget.mem * params.priceMem + budget.steps * params.priceStep, 0);

let current = DEFAULT_PROTOCOL_PARAMS;

/** The parameters in force as far as the site knows them. */
export const protocol = () => current;

export function setProtocol(params: ProtocolParams) {
  current = params;
}
