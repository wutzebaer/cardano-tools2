import { watchConfirmation } from "@cardano/confirmation";
import { getStakeInfo } from "@cardano/dbsync";
import { currentSlot } from "@cardano/network";
import { SimpleScript, WalletConnection } from "@cardano/types";
import { formatAda } from "@cardano/utils";
import {
  Address,
  BigNum,
  Certificate,
  Certificates,
  CoinSelectionStrategyCIP2,
  DataCost,
  DRep,
  Ed25519KeyHash,
  FixedTransaction,
  LinearFee,
  NativeScript,
  NativeScripts,
  PrivateKey,
  RewardAddress,
  ScriptAll,
  ScriptAny,
  ScriptNOfK,
  ScriptPubkey,
  StakeDelegation,
  StakeDeregistration,
  StakeRegistrationAndDelegation,
  TimelockExpiry,
  TimelockStart,
  Transaction,
  TransactionBuilder,
  TransactionBuilderConfigBuilder,
  TransactionOutput,
  TransactionUnspentOutput,
  TransactionUnspentOutputs,
  TransactionWitnessSet,
  Value,
  VoteDelegation,
  Withdrawals,
  min_ada_for_output,
} from "@emurgo/cardano-serialization-lib-browser";

export { currentEpoch, currentSlot, unixToSlot } from "@cardano/network";

const KEY_DEPOSIT = BigNum.from_str("2000000");

export const COINS_PER_UTXO_BYTE = BigNum.from_str("4310");

export const MAX_TX_SIZE = 16384;

/** Seconds a built transaction stays valid. */
export const TTL_SECONDS = 60 * 10;

export const txBuilderConfig = TransactionBuilderConfigBuilder.new()
  .fee_algo(LinearFee.new(BigNum.from_str("44"), BigNum.from_str("155381")))
  .coins_per_utxo_byte(COINS_PER_UTXO_BYTE)
  .pool_deposit(BigNum.from_str("500000000"))
  .key_deposit(KEY_DEPOSIT)
  .max_value_size(5000)
  .max_tx_size(MAX_TX_SIZE)
  .build();

export interface TxOptions {
  /** Extra keys that have to sign, e.g. the key of an imported policy. Never leaves the browser. */
  signingKeys?: PrivateKey[];
  /** Spend from these instead of asking the wallet, used to chain transactions before they are confirmed. */
  utxos?: TransactionUnspentOutput[];
  /**
   * A wallet key that has to sign besides the inputs' keys, e.g. the key of a policy. The transaction then spends
   * from the address of that key and returns the change to it: some wallets (Yoroi) only sign with the keys of
   * the inputs, and the change keeps the address funded for the next time.
   */
  signerKeyHash?: string;
}

const paymentKeyHashOf = (utxo: TransactionUnspentOutput) => utxo.output().address().payment_cred()?.to_keyhash()?.to_hex();

/** The wallet's UTxO with the most ADA at the address of a payment key. */
export function utxoOfKey(utxos: TransactionUnspentOutput[], keyHash: string) {
  return utxos.filter((utxo) => paymentKeyHashOf(utxo) === keyHash).sort((a, b) => b.output().amount().coin().compare(a.output().amount().coin()))[0];
}

export const hexToBytes = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

export async function walletUtxos(connection: WalletConnection) {
  const rawUtxos = (await connection.getUtxos()) ?? [];
  return rawUtxos.map((raw) => TransactionUnspentOutput.from_bytes(hexToBytes(raw)));
}

export async function walletChangeAddress(connection: WalletConnection) {
  return Address.from_bytes(hexToBytes(await connection.getChangeAddress()));
}

/**
 * How inputs are picked, tried in this order. Random selection keeps the wallet's UTxO set healthy but can fail,
 * e.g. when the picked inputs leave too little ADA for the change of their tokens. Spending everything always balances.
 */
const INPUT_STRATEGIES = [CoinSelectionStrategyCIP2.RandomImproveMultiAsset, CoinSelectionStrategyCIP2.LargestFirstMultiAsset, "all"] as const;

export const buildTransaction = async (
  connection: WalletConnection,
  configure: (txBuilder: TransactionBuilder) => void,
  utxos?: TransactionUnspentOutput[],
  signerKeyHash?: string
): Promise<Transaction> => {
  const available = utxos ?? (await walletUtxos(connection));
  const signerUtxo = signerKeyHash ? utxoOfKey(available, signerKeyHash) : undefined;
  const changeAddress = signerUtxo?.output().address() ?? (await walletChangeAddress(connection));
  const spendable = available.filter((utxo) => utxo !== signerUtxo);

  let firstError: unknown;
  let lastError: unknown;
  for (const strategy of INPUT_STRATEGIES) {
    try {
      const txBuilder = TransactionBuilder.new(txBuilderConfig);
      txBuilder.set_ttl(currentSlot() + TTL_SECONDS);

      configure(txBuilder);

      if (signerUtxo) {
        txBuilder.add_regular_input(signerUtxo.output().address(), signerUtxo.input(), signerUtxo.output().amount());
      }
      if (strategy === "all") {
        for (const utxo of spendable) {
          txBuilder.add_regular_input(utxo.output().address(), utxo.input(), utxo.output().amount());
        }
      } else {
        const transactionUnspentOutputs = TransactionUnspentOutputs.new();
        for (const utxo of spendable) {
          transactionUnspentOutputs.add(utxo);
        }
        txBuilder.add_inputs_from(transactionUnspentOutputs, strategy);
      }
      txBuilder.add_change_if_needed(changeAddress);

      return txBuilder.build_tx();
    } catch (error) {
      firstError ??= error;
      lastError = error;
    }
  }
  // the last try spent everything: if even that is short of ADA, the wallet holds too little
  if (isShortOfAda(firstError) || isShortOfAda(lastError)) {
    throw new Error(shortfallMessage(configure, available, changeAddress));
  }
  throw firstError;
};

/** The library's two ways to say that the ADA does not suffice: for the outputs, or for the change that holds the tokens. */
const isShortOfAda = (error: unknown) => /insufficient|not enough ada/i.test(String((error as Error | undefined)?.message ?? error));

const coinOf = (value: Value) => Number(value.coin().to_str());

/** Used where the fee cannot be calculated, a transaction of this site rarely costs more. */
const ASSUMED_FEE = 500_000;

/** What a transaction takes in lovelace, worked out as if it spent everything the wallet offers. */
export interface TransactionNeeds {
  /** The ADA of its outputs and deposits, less what a withdrawal or a returned deposit brings in */
  spent: number;
  fee: number;
  /** The minimum of ADA for the change, which takes all tokens of the wallet and the minted ones back */
  changeMinimum: number;
  /** All of the above: what the wallet has to hold */
  total: number;
  /** What the wallet holds */
  offered: number;
}

export function transactionNeeds(configure: (txBuilder: TransactionBuilder) => void, available: TransactionUnspentOutput[], changeAddress: Address): TransactionNeeds {
  const txBuilder = TransactionBuilder.new(txBuilderConfig);
  txBuilder.set_ttl(currentSlot() + TTL_SECONDS);
  configure(txBuilder);
  for (const utxo of available) {
    txBuilder.add_regular_input(utxo.output().address(), utxo.input(), utxo.output().amount());
  }
  const offered = available.reduce((sum, utxo) => sum + coinOf(utxo.output().amount()), 0);
  const totalInput = txBuilder.get_total_input();
  const totalOutput = txBuilder.get_total_output();
  const spent = coinOf(totalOutput) - (coinOf(totalInput) - offered);

  const changeTokens = totalInput.clamped_sub(totalOutput).multiasset();
  const change = TransactionOutput.new(changeAddress, changeTokens && changeTokens.len() > 0 ? Value.new_with_assets(BigNum.from_str("2000000"), changeTokens) : Value.new(BigNum.from_str("2000000")));
  const changeMinimum = changeTokens && changeTokens.len() > 0 ? Number(min_ada_for_output(change, DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE)).to_str()) : 0;

  let fee = ASSUMED_FEE;
  try {
    // the change is part of what the fee pays for
    txBuilder.add_output(change);
    fee = Number(txBuilder.min_fee().to_str());
  } catch {
    // stays the assumed one
  }
  return { spent, fee, changeMinimum, total: spent + changeMinimum + fee, offered };
}

/**
 * Why the inputs do not cover a transaction, in words: what it needs against what the wallet offers. The library only
 * says "UTxO Balance Insufficient" or "Not enough ADA leftover to include non-ADA assets in a change address".
 */
function shortfallMessage(configure: (txBuilder: TransactionBuilder) => void, available: TransactionUnspentOutput[], changeAddress: Address) {
  const advice = "Add ADA to the wallet and try again. Nothing was submitted.";
  try {
    const { total, offered, changeMinimum } = transactionNeeds(configure, available, changeAddress);
    const missing = total - offered;
    return (
      `Your wallet holds too little ADA for this transaction: it needs about ${formatAda(total)}, the wallet offers ${formatAda(offered)}` +
      (missing > 0 ? `, so about ${formatAda(missing)} are missing. ` : ". ") +
      // outputs to the wallet itself stay as well, they are not told apart here
      (changeMinimum > 0 ? `At least ${formatAda(changeMinimum)} of that stay in your wallet: tokens can only be held together with a minimum of ADA. ` : "") +
      advice
    );
  } catch {
    return `Your wallet holds too little ADA for this transaction. ${advice}`;
  }
}

/** A node's rejection in words where the cause is a known one, otherwise null. */
export function rejectionReason(nodeAnswer: string): string | null {
  const missingKey = nodeAnswer.match(/MissingVKeyWitnessesUTXOW[^\]]*?([0-9a-f]{56})/)?.[1];
  if (missingKey) {
    return `Your wallet did not sign with a key this transaction needs (${missingKey.slice(0, 8)}…). Nothing was submitted. If this is the key of a policy, create a new policy and try again.`;
  }
  if (/All inputs are spent|BadInputsUTxO/.test(nodeAnswer)) {
    return "Your wallet offered coins that are already spent, so nothing was submitted. It has not caught up with your last transaction yet: wait until the wallet shows it, then try again.";
  }
  if (/WdrlNotDelegatedToDRep/.test(nodeAnswer)) {
    return "Rewards can only be withdrawn once the stake key has delegated its vote. Delegate the vote first, wait for the confirmation and try again. Nothing was submitted.";
  }
  if (/StakeKeyHasNonZero\w*Balance/.test(nodeAnswer)) {
    return "The stake key still holds rewards and cannot be deregistered with them. Reload the page so the current amount is paid out along, then try again. Nothing was submitted.";
  }
  return null;
}

/** What a wallet said when it refused to submit; CIP-30 wallets put the node's answer into "info". */
function walletErrorText(walletError: unknown): string {
  const error = walletError as { info?: unknown; message?: unknown } | null | undefined;
  return [error?.info, error?.message].filter((part) => typeof part === "string").join(" ");
}

export const signAndSubmitTransaction =async (connection: WalletConnection, tx: Transaction, signingKeys: PrivateKey[] = []) => {
  // FixedTransaction keeps the body bytes untouched, so the hash the wallet signs is the hash we submit
  const fixedTransaction = FixedTransaction.from_bytes(tx.to_bytes());

  const walletWitnesses = TransactionWitnessSet.from_hex(await connection.signTx(tx.to_hex(), true));
  const vkeys = walletWitnesses.vkeys();
  for (let i = 0; i < (vkeys?.len() ?? 0); i++) {
    fixedTransaction.add_vkey_witness(vkeys!.get(i));
  }
  for (const signingKey of signingKeys) {
    fixedTransaction.sign_and_add_vkey_signature(signingKey);
  }

  const signedTx = fixedTransaction.to_hex();
  try {
    // only the wallet submits: the site hands signed transactions to no other service
    await connection.submitTx(signedTx);
  } catch (walletError) {
    // a known cause in words, anything else as the wallet reported it
    const reason = rejectionReason(walletErrorText(walletError));
    throw reason ? new Error(reason) : walletError;
  }

  const txHash = fixedTransaction.transaction_hash().to_hex();
  announceWalletChange(txHash);
  return txHash;
};

/** Sent to the window when a transaction of this page is on chain, so that what shows the wallet reads it again. */
export const WALLET_CHANGED = "wallet-changed";

/**
 * Follows a submitted transaction and says so once it is confirmed. Wallets take a moment to see their new balance,
 * so it is said again a little later.
 */
function announceWalletChange(txHash: string) {
  if (typeof window === "undefined") return;
  const announce = () => window.dispatchEvent(new Event(WALLET_CHANGED));
  watchConfirmation(txHash, () => {
    announce();
    setTimeout(announce, 10_000);
    setTimeout(announce, 30_000);
  });
}

export const sendTransaction = async (connection: WalletConnection, configure: (txBuilder: TransactionBuilder) => void, options: TxOptions = {}) => {
  const tx = await buildTransaction(connection, configure, options.utxos, options.signerKeyHash);
  return signAndSubmitTransaction(connection, tx, options.signingKeys);
};

export const sendAda = async (connection: WalletConnection, targetAddress: Address, amount: BigNum) => {
  return sendTransaction(connection, (txBuilder) => {
    txBuilder.add_output(TransactionOutput.new(targetAddress, Value.new(amount)));
  });
};

export const delegateToPool = async (connection: WalletConnection, poolId: string) => {
  const poolKeyHash = Ed25519KeyHash.from_bech32(poolId);

  const rewardAddressHash = (await connection.getRewardAddresses())[0];
  const stakeAddress = rewardAddressHashToBech32(rewardAddressHash);
  const address = Address.from_bytes(hexToBytes(rewardAddressHash));
  const rewardAddress = RewardAddress.from_address(address)!;
  const stakeCredential = rewardAddress.payment_cred();

  let registered = false;
  try {
    registered = Boolean((await getStakeInfo(stakeAddress)).poolHash);
  } catch {
    registered = false;
  }

  const certificates = Certificates.new();
  if (registered) {
    certificates.add(Certificate.new_stake_delegation(StakeDelegation.new(stakeCredential, poolKeyHash)));
  } else {
    certificates.add(
      Certificate.new_stake_registration_and_delegation(StakeRegistrationAndDelegation.new(stakeCredential, poolKeyHash, KEY_DEPOSIT))
    );
  }

  return sendTransaction(connection, (txBuilder) => {
    txBuilder.set_certs(certificates);
  });
};

/** Who a stake key hands its vote to: one of the two automatic choices or the id of a DRep (`drep1…`). */
export type VoteTarget = "abstain" | "no_confidence" | string;

export async function walletRewardAddress(connection: WalletConnection) {
  const rewardAddress = RewardAddress.from_address(Address.from_bytes(hexToBytes((await connection.getRewardAddresses())[0])));
  if (!rewardAddress) throw new Error("Your wallet reports no stake address");
  return rewardAddress;
}

/** Delegates the voting power of the wallet's stake key. Since the Conway era rewards can only be withdrawn with a vote delegation. */
export const delegateVote = async (connection: WalletConnection, target: VoteTarget) => {
  const stakeCredential = (await walletRewardAddress(connection)).payment_cred();
  let drep: DRep;
  if (target === "abstain") {
    drep = DRep.new_always_abstain();
  } else if (target === "no_confidence") {
    drep = DRep.new_always_no_confidence();
  } else {
    try {
      drep = DRep.from_bech32(target.trim());
    } catch {
      throw new Error("This is not a DRep id. It starts with drep1.");
    }
  }
  const certificates = Certificates.new();
  certificates.add(Certificate.new_vote_delegation(VoteDelegation.new(stakeCredential, drep)));
  return sendTransaction(connection, (txBuilder) => {
    txBuilder.set_certs(certificates);
  });
};

/** Moves the staking rewards of the wallet into its spendable balance. The chain only takes the exact amount that is available. */
export const withdrawRewards = async (connection: WalletConnection, lovelace: bigint) => {
  const withdrawals = Withdrawals.new();
  withdrawals.insert(await walletRewardAddress(connection), BigNum.from_str(`${lovelace}`));
  return sendTransaction(connection, (txBuilder) => {
    txBuilder.set_withdrawals(withdrawals);
  });
};

/**
 * Deregisters the wallet's stake key: its delegations end and the deposit comes back. The chain refuses to deregister
 * a key with rewards left, so the rewards that are available are withdrawn in the same transaction.
 */
export const deregisterStake = async (connection: WalletConnection, rewardsLovelace: bigint) => {
  const rewardAddress = await walletRewardAddress(connection);
  const certificates = Certificates.new();
  certificates.add(Certificate.new_stake_deregistration(StakeDeregistration.new(rewardAddress.payment_cred())));
  return sendTransaction(connection, (txBuilder) => {
    txBuilder.set_certs(certificates);
    if (rewardsLovelace > 0n) {
      const withdrawals = Withdrawals.new();
      withdrawals.insert(rewardAddress, BigNum.from_str(`${rewardsLovelace}`));
      txBuilder.set_withdrawals(withdrawals);
    }
  });
};

export const toNativeScript = (simpleScript: SimpleScript): NativeScript => {
  const children = () => {
    const scripts = NativeScripts.new();
    for (const script of simpleScript.scripts ?? []) {
      scripts.add(toNativeScript(script));
    }
    return scripts;
  };
  switch (simpleScript.type) {
    case "all":
      return NativeScript.new_script_all(ScriptAll.new(children()));
    case "any":
      return NativeScript.new_script_any(ScriptAny.new(children()));
    case "atLeast":
      return NativeScript.new_script_n_of_k(ScriptNOfK.new(simpleScript.required!, children()));
    case "before":
      return NativeScript.new_timelock_expiry(TimelockExpiry.new_timelockexpiry(BigNum.from_str(`${simpleScript.slot}`)));
    case "after":
      return NativeScript.new_timelock_start(TimelockStart.new_timelockstart(BigNum.from_str(`${simpleScript.slot}`)));
    case "sig":
      return NativeScript.new_script_pubkey(ScriptPubkey.new(Ed25519KeyHash.from_hex(`${simpleScript.keyHash}`)));
    default:
      throw new Error(`Cannot parse ${JSON.stringify(simpleScript)}`);
  }
};

export function rewardAddressHashToBech32(rewardAddressHash?: string) {
  if (!rewardAddressHash) return "";
  return Address.from_bytes(hexToBytes(rewardAddressHash)).to_bech32();
}
