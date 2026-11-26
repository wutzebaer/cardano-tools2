import { ONE_ADA, RewardPosition } from "@cardano/distribution";
import { protocol } from "@cardano/protocol";
import { buildTransaction, dataCost, hexToBytes, signAndSubmitTransaction, walletUtxos } from "@cardano/transaction";
import { WalletConnection } from "@cardano/types";
import { sleep } from "@cardano/utils";
import {
  Address,
  AssetName,
  BigNum,
  MetadataJsonSchema,
  min_ada_for_output,
  MultiAsset,
  ScriptHash,
  Transaction,
  TransactionOutput,
  Value,
} from "@emurgo/cardano-serialization-lib-browser";

/** Bytes of outputs per transaction; leaves room for inputs, change, witnesses and the message. */
const outputBytesPerTx = () => protocol().maxTxSize - 6000;

const MESSAGE_LABEL = "674";

function positionValue(position: Pick<RewardPosition, "lovelace" | "tokens">) {
  const value = Value.new(BigNum.from_str(`${position.lovelace}`));
  if (position.tokens.size > 0) {
    const multiAsset = MultiAsset.new();
    for (const [key, amount] of position.tokens) {
      const [policyId, name] = key.split(".");
      multiAsset.set_asset(ScriptHash.from_hex(policyId), AssetName.new(hexToBytes(name)), BigNum.from_str(`${amount}`));
    }
    value.set_multiasset(multiAsset);
  }
  return value;
}

function positionOutput(position: Pick<RewardPosition, "address" | "lovelace" | "tokens">) {
  return TransactionOutput.new(Address.from_bech32(position.address), positionValue(position));
}

/** Minimum ADA an output to `address` carrying `tokens` needs. */
export function minLovelaceForOutput(address: string, tokens: Map<string, bigint>) {
  const output = positionOutput({ address, lovelace: ONE_ADA, tokens });
  return BigInt(min_ada_for_output(output, dataCost()).to_str());
}

/** One transaction holds only so many outputs, so large distributions are split. */
export function batchPositions(positions: RewardPosition[]): RewardPosition[][] {
  const batches: RewardPosition[][] = [];
  let batch: RewardPosition[] = [];
  let bytes = 0;
  for (const position of positions) {
    const size = positionOutput(position).to_bytes().length;
    if (batch.length > 0 && bytes + size > outputBytesPerTx()) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(position);
    bytes += size;
  }
  if (batch.length > 0) {
    batches.push(batch);
  }
  return batches;
}

function spentInputs(tx: Transaction) {
  const inputs = tx.body().inputs();
  return Array.from({ length: inputs.len() }, (_, i) => inputs.get(i).to_hex());
}

/** Waits until the wallet no longer offers the inputs of `tx`, i.e. it has noticed the transaction. */
export async function waitUntilSpent(connection: WalletConnection, tx: Transaction) {
  const spent = new Set(spentInputs(tx));
  for (let attempt = 0; attempt < 240; attempt++) {
    await sleep(5000);
    const utxos = await walletUtxos(connection);
    if (!utxos.some((utxo) => spent.has(utxo.input().to_hex()))) {
      return;
    }
  }
  throw new Error("The wallet did not pick up the previous transaction, remaining batches were not sent");
}

export interface DistributionProgress {
  batch: number;
  batches: number;
  state: "signing" | "waiting" | "done";
  txHashes: string[];
}

/**
 * Sends every batch as its own transaction from the connected wallet.
 * Batches are sent one after another, each waits for the wallet to see the previous one.
 * `sent` are the hashes of an earlier try that stopped on the way: its batches are paid and are not sent again.
 */
export async function sendRewards(connection: WalletConnection, batches: RewardPosition[][], message: string, onProgress: (progress: DistributionProgress) => void, sent: string[] = []) {
  const txHashes: string[] = [...sent];
  for (let i = sent.length; i < batches.length; i++) {
    onProgress({ batch: i + 1, batches: batches.length, state: "signing", txHashes: [...txHashes] });
    const tx = await buildTransaction(connection, (txBuilder) => {
      for (const position of batches[i]) {
        txBuilder.add_output(positionOutput(position));
      }
      if (message.trim()) {
        txBuilder.add_json_metadatum_with_schema(BigNum.from_str(MESSAGE_LABEL), JSON.stringify({ msg: [message.trim()] }), MetadataJsonSchema.NoConversions);
      }
    });
    txHashes.push(await signAndSubmitTransaction(connection, tx));
    if (i < batches.length - 1) {
      onProgress({ batch: i + 1, batches: batches.length, state: "waiting", txHashes: [...txHashes] });
      await waitUntilSpent(connection, tx);
    }
  }
  onProgress({ batch: batches.length, batches: batches.length, state: "done", txHashes: [...txHashes] });
  return txHashes;
}
