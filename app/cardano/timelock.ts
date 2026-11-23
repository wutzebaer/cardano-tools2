import { getTransactionMetadata, getUtxos } from "@cardano/dbsync";
import { scriptAddress } from "@cardano/mint";
import { currentSlot, slotToUnix, unixToSlot } from "@cardano/network";
import { candidateUnlockTimes, TIMELOCK_LABEL, timelockMetadata, timeScriptHash, unlockSlotsFromMetadata } from "@cardano/timelockScript";
import { COINS_PER_UTXO_BYTE, hexToBytes, sendTransaction, walletChangeAddress } from "@cardano/transaction";
import { WalletConnection } from "@cardano/types";
import {
  Address,
  AssetName,
  BigNum,
  DataCost,
  Ed25519KeyHash,
  MetadataJsonSchema,
  min_ada_for_output,
  MultiAsset,
  NativeScript,
  NativeScripts,
  ScriptAll,
  ScriptHash,
  ScriptPubkey,
  TimelockStart,
  TransactionHash,
  TransactionInput,
  TransactionOutput,
  Value,
} from "@emurgo/cardano-serialization-lib-browser";

export interface LockedToken {
  policyId: string;
  /** Asset name as hex */
  name: string;
  quantity: bigint;
}

/** One output locked at a timelock script of the wallet. */
export interface Timelock {
  txHash: string;
  txIndex: number;
  address: string;
  /** Wallet key the script asks a signature of */
  keyHash: string;
  unlockSlot: number;
  lovelace: bigint;
  tokens: LockedToken[];
}

export const timelockKey = (lock: Pick<Timelock, "txHash" | "txIndex">) => `${lock.txHash}#${lock.txIndex}`;

export const isUnlockable = (lock: Timelock) => lock.unlockSlot <= currentSlot();

export const unlockDate = (lock: Pick<Timelock, "unlockSlot">) => new Date(slotToUnix(lock.unlockSlot) * 1000);

/** The script as cardano-cli reads it, for whoever wants to keep it or spend without this site. */
export const timelockScriptJson = (keyHash: string, unlockSlot: number) => ({
  type: "all",
  scripts: [
    { type: "sig", keyHash },
    { type: "after", slot: unlockSlot },
  ],
});

export function timelockScript(keyHash: string, unlockSlot: number) {
  const scripts = NativeScripts.new();
  scripts.add(NativeScript.new_script_pubkey(ScriptPubkey.new(Ed25519KeyHash.from_hex(keyHash))));
  scripts.add(NativeScript.new_timelock_start(TimelockStart.new_timelockstart(BigNum.from_str(`${unlockSlot}`))));
  return NativeScript.new_script_all(ScriptAll.new(scripts));
}

export function timelockAddress(changeAddress: Address, keyHash: string, unlockSlot: number) {
  return scriptAddress(changeAddress, timelockScript(keyHash, unlockSlot));
}

function lockValue(lovelace: bigint, tokens: LockedToken[]) {
  const value = Value.new(BigNum.from_str(`${lovelace}`));
  if (tokens.length > 0) {
    const multiAsset = MultiAsset.new();
    for (const token of tokens) {
      multiAsset.set_asset(ScriptHash.from_hex(token.policyId), AssetName.new(hexToBytes(token.name)), BigNum.from_str(`${token.quantity}`));
    }
    value.set_multiasset(multiAsset);
  }
  return value;
}

/** ADA an output with these tokens needs at the least, a lock of tokens alone gets this much ADA along. */
export function minLockLovelace(changeAddress: Address, keyHash: string, unlockSlot: number, tokens: LockedToken[]) {
  const output = TransactionOutput.new(timelockAddress(changeAddress, keyHash, unlockSlot), lockValue(1_000_000n, tokens));
  return BigInt(min_ada_for_output(output, DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE)).to_str());
}

/** Sends ADA and tokens to the timelock address of the key. Until the slot nobody can move them, the owner included. */
export async function lockFunds(connection: WalletConnection, keyHash: string, unlockSlot: number, lovelace: bigint, tokens: LockedToken[]) {
  const address = timelockAddress(await walletChangeAddress(connection), keyHash, unlockSlot);
  return sendTransaction(connection, (txBuilder) => {
    txBuilder.add_output(TransactionOutput.new(address, lockValue(lovelace, tokens)));
    // the slot is all it takes to rebuild the script, the lock is found again by it
    txBuilder.add_json_metadatum_with_schema(BigNum.from_str(`${TIMELOCK_LABEL}`), JSON.stringify(timelockMetadata(unlockSlot)), MetadataJsonSchema.NoConversions);
  });
}

/** Unlock slots the transactions name in their metadata. A failed lookup only means the lock is searched by date. */
async function metadataSlots(txHashes: string[]) {
  const slots = new Map<string, number[]>();
  await Promise.all(
    txHashes.map(async (txHash) => {
      slots.set(txHash, unlockSlotsFromMetadata(await getTransactionMetadata(txHash).catch(() => null)));
    })
  );
  return slots;
}

/**
 * The wallet's locks, found on chain: outputs under its stake key at an address whose script is a timelock of
 * one of its keys. Other script outputs of the stake key (reference NFTs, contracts) match no candidate and are left out.
 */
export async function findTimelocks(stakeAddress: string, keyHashes: string[]): Promise<Timelock[]> {
  const rows = await getUtxos(stakeAddress);

  const outputs = new Map<string, { rows: typeof rows; scriptHash: string; txHash: string }>();
  for (const row of rows) {
    const key = `${row.txHash}#${row.txIndex}`;
    let output = outputs.get(key);
    if (!output) {
      const scriptHash = Address.from_bech32(row.owningAddress).payment_cred()?.to_scripthash()?.to_hex();
      if (!scriptHash) continue;
      output = { rows: [], scriptHash, txHash: row.txHash };
      outputs.set(key, output);
    }
    output.rows.push(row);
  }
  if (outputs.size === 0) return [];

  const scripts = new Map<string, { keyHash: string; unlockSlot: number }>();
  const search = (scriptHashes: Set<string>, slots: number[]) => {
    const wanted = new Set([...scriptHashes].filter((hash) => !scripts.has(hash)));
    for (const keyHash of keyHashes) {
      for (const unlockSlot of slots) {
        if (wanted.size === 0) return;
        const hash = timeScriptHash(keyHash, "after", unlockSlot);
        if (wanted.delete(hash)) scripts.set(hash, { keyHash, unlockSlot });
      }
    }
  };

  // the slot from the metadata of the transaction that made the output
  const slotsByTx = await metadataSlots([...new Set([...outputs.values()].map((output) => output.txHash))]);
  for (const output of outputs.values()) {
    search(new Set([output.scriptHash]), slotsByTx.get(output.txHash) ?? []);
  }
  // locks of the first version carry no metadata and end at midnight UTC
  search(
    new Set([...outputs.values()].map((output) => output.scriptHash)),
    candidateUnlockTimes(Date.now() / 1000).map((unix) => unixToSlot(unix))
  );

  const locks: Timelock[] = [];
  for (const output of outputs.values()) {
    const script = scripts.get(output.scriptHash);
    const ada = output.rows.find((row) => !row.maPolicyId);
    if (!script || !ada) continue;
    locks.push({
      txHash: ada.txHash,
      txIndex: ada.txIndex,
      address: ada.owningAddress,
      ...script,
      lovelace: BigInt(ada.value),
      tokens: output.rows.filter((row) => row.maPolicyId).map((row) => ({ policyId: row.maPolicyId!, name: row.maName ?? "", quantity: BigInt(row.value) })),
    });
  }
  return locks.sort((a, b) => a.unlockSlot - b.unlockSlot || timelockKey(a).localeCompare(timelockKey(b)));
}

/** Takes locks back whose time is over. All of them have to be locked with the same key, one transaction asks one signature. */
export async function unlockFunds(connection: WalletConnection, locks: Timelock[]) {
  const keyHash = locks[0].keyHash;
  if (locks.some((lock) => lock.keyHash !== keyHash)) {
    throw new Error("These locks belong to different keys of your wallet, unlock them one by one");
  }
  return sendTransaction(
    connection,
    (txBuilder) => {
      for (const lock of locks) {
        txBuilder.add_native_script_input(
          timelockScript(lock.keyHash, lock.unlockSlot),
          TransactionInput.new(TransactionHash.from_hex(lock.txHash), lock.txIndex),
          lockValue(lock.lovelace, lock.tokens)
        );
      }
      txBuilder.add_required_signer(Ed25519KeyHash.from_hex(keyHash));
      // "after slot" holds only for a transaction that says it is not valid before that slot
      txBuilder.set_validity_start_interval_bignum(BigNum.from_str(`${Math.max(...locks.map((lock) => lock.unlockSlot))}`));
    },
    // the key has to sign although no input of the wallet may belong to it
    { signerKeyHash: keyHash }
  );
}
