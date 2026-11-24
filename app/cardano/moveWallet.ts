import { currentSlot } from "@cardano/network";
import { signAndSubmitTransaction, TTL_SECONDS, txBuilderConfig, walletRewardAddress, walletUtxos } from "@cardano/transaction";
import { WalletConnection } from "@cardano/types";
import {
  Address,
  BigNum,
  Certificate,
  Certificates,
  RewardAddress,
  StakeDeregistration,
  Transaction,
  TransactionBuilder,
  TransactionUnspentOutput,
  Withdrawals,
} from "@emurgo/cardano-serialization-lib-browser";

export interface MoveProgress {
  /** 1-based number of the transaction that is waiting for a signature */
  transaction: number;
  /** UTxOs still in the wallet, the ones of this transaction included */
  remaining: number;
}

interface Unstake {
  rewardAddress: RewardAddress;
  rewards: bigint;
}

/** These UTxOs as inputs and everything that is left after the fee as output to the target, with the stake key deregistered if asked. */
function moveTransaction(utxos: TransactionUnspentOutput[], target: Address, unstake?: Unstake): Transaction {
  const txBuilder = TransactionBuilder.new(txBuilderConfig);
  txBuilder.set_ttl(currentSlot() + TTL_SECONDS);
  for (const utxo of utxos) {
    txBuilder.add_regular_input(utxo.output().address(), utxo.input(), utxo.output().amount());
  }
  if (unstake) {
    // the deposit of the key and the rewards flow into the same output
    const certificates = Certificates.new();
    certificates.add(Certificate.new_stake_deregistration(StakeDeregistration.new(unstake.rewardAddress.payment_cred())));
    txBuilder.set_certs(certificates);
    if (unstake.rewards > 0n) {
      const withdrawals = Withdrawals.new();
      withdrawals.insert(unstake.rewardAddress, BigNum.from_str(`${unstake.rewards}`));
      txBuilder.set_withdrawals(withdrawals);
    }
  }
  if (!txBuilder.add_change_if_needed(target)) {
    throw new Error("There is too little ADA to pay the fee and the minimum an output has to hold");
  }
  return txBuilder.build_tx();
}

/**
 * Sends everything the wallet holds, ADA and tokens, to the target. A wallet with more UTxOs than fit into one
 * transaction is emptied in several, each asks for a signature. With `unstakeRewards` (the rewards to pay out,
 * possibly zero) the last transaction also deregisters the stake key, which returns its deposit.
 */
export async function moveEverything(connection: WalletConnection, target: Address, unstakeRewards: bigint | null, onProgress: (progress: MoveProgress) => void): Promise<string[]> {
  let remaining = await walletUtxos(connection);
  if (remaining.length === 0) {
    throw new Error("Your wallet reports no ADA or tokens. If you just received some, wait until the wallet shows them.");
  }
  const unstake = unstakeRewards == null ? undefined : { rewardAddress: await walletRewardAddress(connection), rewards: unstakeRewards };
  const txHashes: string[] = [];

  while (remaining.length > 0) {
    // as many UTxOs as fit: all of them if possible, otherwise half as many until the transaction can be built
    let count = remaining.length;
    let tx: Transaction | undefined;
    let failure: unknown;
    while (count >= 1 && !tx) {
      try {
        tx = moveTransaction(remaining.slice(0, count), target, count === remaining.length ? unstake : undefined);
      } catch (error) {
        failure = error;
        count = count === 1 ? 0 : Math.ceil(count / 2);
      }
    }
    if (!tx) throw failure;
    onProgress({ transaction: txHashes.length + 1, remaining: remaining.length });
    txHashes.push(await signAndSubmitTransaction(connection, tx));
    remaining = remaining.slice(count);
  }
  return txHashes;
}
