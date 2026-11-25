import { waitUntilSpent } from "@cardano/rewards";
import { buildTransaction, COINS_PER_UTXO_BYTE, currentSlot, hexToBytes, signAndSubmitTransaction, toNativeScript, transactionNeeds, TTL_SECONDS, TxOptions, walletChangeAddress, walletUtxos } from "@cardano/transaction";
import { MintPolicy, MintToken, SimpleScript, TokenDetails, WalletConnection } from "@cardano/types";
import { cip25Metadata, MetaValue, tokenMetadata } from "@cardano/metadata";
import { crc8, scriptLockSlot } from "@cardano/utils";
import {
  Address,
  AssetName,
  BaseAddress,
  BigInt as CslBigInt,
  BigNum,
  ConstrPlutusData,
  Credential,
  DataCost,
  Ed25519KeyHash,
  EnterpriseAddress,
  Int,
  MetadataJsonSchema,
  MintBuilder,
  MintWitness,
  MultiAsset,
  NativeScript,
  NativeScriptSource,
  PlutusData,
  PlutusList,
  PlutusMap,
  PlutusMapValues,
  PrivateKey,
  ScriptHash,
  ScriptPubkey,
  TransactionBuilder,
  TransactionOutputBuilder,
} from "@emurgo/cardano-serialization-lib-browser";

const REFERENCE_LABEL = 100;

export const utf8Bytes = (text: string) => new TextEncoder().encode(text);

// ---------------------------------------------------------------------------
// Policy: derived from the wallet's payment key, nothing secret to store
// ---------------------------------------------------------------------------

export function paymentKeyHash(changeAddressHex: string) {
  return Address.from_bytes(hexToBytes(changeAddressHex)).payment_cred()!.to_keyhash()!.to_hex();
}

export function policyScript(policy: MintPolicy): NativeScript {
  return toNativeScript(policy.script);
}

/**
 * A policy signed by the wallet's key. With `days` it locks after that time. Without, it never locks: it names the
 * slot it was created in as its start instead, which is always past, so every such policy still gets an id of its own.
 */
export function createPolicy(keyHash: string, days: number | null): MintPolicy {
  const now = Math.floor(currentSlot());
  const script: SimpleScript = {
    type: "all",
    // an hour back, so a clock that runs ahead of the chain does not make the first mint invalid
    scripts: [{ type: "sig", keyHash }, days == null ? { type: "after", slot: now - 3600 } : { type: "before", slot: now + days * 24 * 60 * 60 }],
  };
  return { policyId: toNativeScript(script).hash().to_hex(), script };
}

export function scriptKeyHashes(script: SimpleScript): string[] {
  if (script.type === "sig" && script.keyHash) {
    return [script.keyHash];
  }
  return script.scripts?.flatMap(scriptKeyHashes) ?? [];
}

/** The key of the policy script this wallet signs with, if it is one of the wallet's keys. */
export function policyWalletKeyHash(policy: MintPolicy, keyHashes: string[]) {
  return scriptKeyHashes(policy.script).find((keyHash) => keyHashes.includes(keyHash));
}

/** Wallet-key policies are signed by the wallet, imported policies by their stored key. */
export function canSignPolicy(policy: MintPolicy, keyHashes: string[]) {
  return Boolean(policy.skey) || policyWalletKeyHash(policy, keyHashes) != null;
}

/** The slots a script names with `after`. A transaction has to say it is not valid before them for the script to validate. */
function scriptStartSlots(script: SimpleScript): number[] {
  if (script.type === "after" && typeof script.slot === "number") return [script.slot];
  return script.scripts?.flatMap(scriptStartSlots) ?? [];
}

/** Sets validity and required signer so the policy script validates. */
export function applyPolicy(txBuilder: TransactionBuilder, policy: MintPolicy, keyHashes: string[]) {
  const dueSlot = policyDueSlot(policy);
  if (dueSlot != null) {
    txBuilder.set_ttl(Math.min(currentSlot() + TTL_SECONDS, dueSlot));
  }
  const startSlots = scriptStartSlots(policy.script);
  if (startSlots.length > 0) {
    txBuilder.set_validity_start_interval_bignum(BigNum.from_str(`${Math.max(...startSlots)}`));
  }
  const walletKeyHash = policyWalletKeyHash(policy, keyHashes);
  if (walletKeyHash) {
    txBuilder.add_required_signer(Ed25519KeyHash.from_hex(walletKeyHash));
  }
}

/** How a transaction of the policy gets signed: by its stored key if it was imported, otherwise by the wallet's key. */
export function policyTxOptions(policy: MintPolicy, keyHashes: string[]): TxOptions {
  return policy.skey ? { signingKeys: [PrivateKey.from_hex(policy.skey)] } : { signerKeyHash: policyWalletKeyHash(policy, keyHashes) };
}

export function policyDueSlot(policy: MintPolicy) {
  return scriptLockSlot(policy.script);
}

export function policySecondsLeft(policy: MintPolicy) {
  const dueSlot = policyDueSlot(policy);
  return dueSlot == null ? Number.POSITIVE_INFINITY : dueSlot - currentSlot();
}

export function policiesFromMints(mints: TokenDetails[], keyHashes: string[]) {
  const byId = new Map<string, MintPolicy>();
  for (const mint of mints) {
    if (byId.has(mint.maPolicyId)) {
      continue;
    }
    try {
      const script = JSON.parse(mint.maPolicyScript) as SimpleScript;
      const policy = { policyId: mint.maPolicyId, script };
      toNativeScript(script);
      if (policyWalletKeyHash(policy, keyHashes)) {
        byId.set(mint.maPolicyId, policy);
      }
    } catch {
      continue;
    }
  }
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// CIP-67 asset names
// ---------------------------------------------------------------------------

/** CIP-67: `0000 | 16 bit label | 8 bit crc | 0000` */
export function cip67LabelBytes(label: number) {
  const labelBytes = new Uint8Array([label >> 8, label & 0xff]);
  const value = (label << 12) | (crc8(labelBytes) << 4);
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function labeledAssetNameBytes(label: number, assetName: string) {
  return Uint8Array.from(Buffer.concat([cip67LabelBytes(label), utf8Bytes(assetName)]));
}

export function labeledAssetNameHex(label: number, assetName: string) {
  return Buffer.from(labeledAssetNameBytes(label, assetName)).toString("hex");
}

function labeledAssetName(label: number, assetName: string) {
  return AssetName.new(labeledAssetNameBytes(label, assetName));
}

// ---------------------------------------------------------------------------
// CIP-68 datum
// ---------------------------------------------------------------------------

function toPlutusData(value: MetaValue): PlutusData {
  if (typeof value === "number") {
    return PlutusData.new_integer(CslBigInt.from_str(`${value}`));
  }
  if (typeof value === "string") {
    return PlutusData.new_bytes(utf8Bytes(value));
  }
  if (Array.isArray(value)) {
    const list = PlutusList.new();
    for (const item of value) {
      list.add(toPlutusData(item));
    }
    return PlutusData.new_list(list);
  }
  const map = PlutusMap.new();
  for (const [key, item] of Object.entries(value)) {
    const values = PlutusMapValues.new();
    values.add(toPlutusData(item));
    map.insert(PlutusData.new_bytes(utf8Bytes(key)), values);
  }
  return PlutusData.new_map(map);
}

/** `Constr 0 [metadata, version = 1, extra = Constr 0 []]` */
export function tokenDatum(token: MintToken): PlutusData {
  const fields = PlutusList.new();
  fields.add(toPlutusData(tokenMetadata(token)));
  fields.add(PlutusData.new_integer(CslBigInt.one()));
  fields.add(PlutusData.new_empty_constr_plutus_data(BigNum.zero()));
  return PlutusData.new_constr_plutus_data(ConstrPlutusData.new(BigNum.zero(), fields));
}

// ---------------------------------------------------------------------------
// Mint transaction
// ---------------------------------------------------------------------------

/**
 * Reference NFTs are locked at a script address `sig(walletKeyHash)` (with the wallet's stake credential),
 * so wallets never spend them accidentally, while the owner can still update the metadata later.
 */
export function referenceAddress(changeAddress: Address, keyHash: string) {
  return scriptAddress(changeAddress, NativeScript.new_script_pubkey(ScriptPubkey.new(Ed25519KeyHash.from_hex(keyHash))));
}

/** Address of a native script that keeps the wallet's stake credential, so what is locked there still counts for its delegation. */
export function scriptAddress(changeAddress: Address, script: NativeScript) {
  const payment = Credential.from_scripthash(script.hash());
  const stake = BaseAddress.from_address(changeAddress)?.stake_cred();
  const network = changeAddress.network_id();
  return stake ? BaseAddress.new(network, payment, stake).to_address() : EnterpriseAddress.new(network, payment).to_address();
}

/** Key that locks the reference NFTs: the policy's wallet key, so the address stays stable if the wallet rotates change addresses. */
export function referenceKeyHash(policy: MintPolicy, keyHashes: string[], changeAddress: Address) {
  return policyWalletKeyHash(policy, keyHashes) ?? changeAddress.payment_cred()!.to_keyhash()!.to_hex();
}

/** The output that holds the reference NFT of a token with its metadata, carrying the minimum of ADA such an output needs. */
function referenceOutput(address: Address, policyHash: ScriptHash, token: MintToken) {
  const referenceAsset = MultiAsset.new();
  referenceAsset.set_asset(policyHash, labeledAssetName(REFERENCE_LABEL, token.assetName), BigNum.one());
  return TransactionOutputBuilder.new()
    .with_address(address)
    .with_plutus_data(tokenDatum(token))
    .next()
    .with_asset_and_min_required_coin_by_utxo_cost(referenceAsset, DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE))
    .build();
}

/**
 * Where the metadata of minted tokens goes. "cip68": into the datum of a reference NFT per token, which takes an output
 * with a deposit each. "cip25": into the metadata of the mint transaction, which costs no deposit and stays as it is.
 */
export type MintFormat = "cip68" | "cip25";

const CIP25_LABEL = 721;

/** The asset name (hex) a token gets on chain: with the label of its standard for CIP-68, as it is for CIP-25. */
export function mintedAssetNameHex(token: MintToken, format: MintFormat) {
  return format === "cip25" ? Buffer.from(utf8Bytes(token.assetName)).toString("hex") : labeledAssetNameHex(token.standard, token.assetName);
}

/** What a mint puts into its transaction: the tokens for the wallet, and their metadata where the format wants it. */
function mintConfigure(policy: MintPolicy, tokens: MintToken[], keyHashes: string[], changeAddress: Address, format: MintFormat) {
  const script = policyScript(policy);
  const policyHash = script.hash();
  const referenceOutputAddress = referenceAddress(changeAddress, referenceKeyHash(policy, keyHashes, changeAddress));
  const dataCost = DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE);

  return (txBuilder: TransactionBuilder) => {
    const mintBuilder = MintBuilder.new();
    const witness = MintWitness.new_native_script(NativeScriptSource.new(script));
    const userAssets = MultiAsset.new();

    for (const token of tokens) {
      const userName = AssetName.new(hexToBytes(mintedAssetNameHex(token, format)));
      mintBuilder.add_asset(witness, userName, Int.from_str(token.amount));
      userAssets.set_asset(policyHash, userName, BigNum.from_str(token.amount));

      if (format === "cip68") {
        mintBuilder.add_asset(witness, labeledAssetName(REFERENCE_LABEL, token.assetName), Int.new_i32(1));
        txBuilder.add_output(referenceOutput(referenceOutputAddress, policyHash, token));
      }
    }
    if (format === "cip25") {
      txBuilder.add_json_metadatum_with_schema(BigNum.from_str(`${CIP25_LABEL}`), JSON.stringify(cip25Metadata(policy.policyId, tokens)), MetadataJsonSchema.NoConversions);
    }

    txBuilder.add_output(TransactionOutputBuilder.new().with_address(changeAddress).next().with_asset_and_min_required_coin_by_utxo_cost(userAssets, dataCost).build());
    txBuilder.set_mint_builder(mintBuilder);
    applyPolicy(txBuilder, policy, keyHashes);
  };
}

/**
 * Bytes the tokens of one mint transaction may take. A transaction holds 16 kB, the rest is left for its inputs,
 * signatures, the script and the change with the other tokens of the wallet.
 */
const MINT_BATCH_BYTES = 13_000;

/** About what a token adds to its mint transaction, rather too much than too little. */
function tokenBytes(policy: MintPolicy, token: MintToken, format: MintFormat, reference: Address) {
  // the entries of the mint and of the output with the minted tokens
  const names = 2 * (utf8Bytes(token.assetName).length + 12);
  if (format === "cip25") return names + utf8Bytes(JSON.stringify(cip25Metadata(policy.policyId, [token])[policy.policyId])).length;
  return 2 * names + referenceOutput(reference, policyScript(policy).hash(), token).to_bytes().length;
}

/** The tokens in the order given, cut into as many transactions as it takes to fit them. */
function mintBatches(policy: MintPolicy, tokens: MintToken[], keyHashes: string[], changeAddress: Address, format: MintFormat) {
  const reference = referenceAddress(changeAddress, referenceKeyHash(policy, keyHashes, changeAddress));
  const batches: MintToken[][] = [[]];
  let bytes = 0;
  for (const token of tokens) {
    const size = tokenBytes(policy, token, format, reference);
    if (bytes + size > MINT_BATCH_BYTES && batches[batches.length - 1].length > 0) {
      batches.push([]);
      bytes = 0;
    }
    batches[batches.length - 1].push(token);
    bytes += size;
  }
  return batches;
}

export interface MintProgress {
  /** The transaction that is being signed or waited for, counted from 1 */
  batch: number;
  batches: number;
  state: "signing" | "waiting";
}

/** Thrown when a mint of several transactions stops on the way: what is minted stays minted. */
export class PartialMintError extends Error {
  constructor(
    readonly txHashes: string[],
    readonly minted: MintToken[],
    readonly cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

/**
 * Mints the tokens, in several transactions if one does not hold them. They are signed one after another, each once
 * the wallet has seen the one before. Returns the hashes of the transactions.
 */
export async function mintTokens(connection: WalletConnection, policy: MintPolicy, tokens: MintToken[], keyHashes: string[], format: MintFormat = "cip68", onProgress?: (progress: MintProgress) => void) {
  const changeAddress = await walletChangeAddress(connection);
  const batches = mintBatches(policy, tokens, keyHashes, changeAddress, format);
  const txHashes: string[] = [];
  const minted: MintToken[] = [];
  try {
    for (let index = 0; index < batches.length; index++) {
      onProgress?.({ batch: index + 1, batches: batches.length, state: "signing" });
      const tx = await buildTransaction(connection, mintConfigure(policy, batches[index], keyHashes, changeAddress, format), undefined, policyTxOptions(policy, keyHashes).signerKeyHash);
      txHashes.push(await signAndSubmitTransaction(connection, tx, policyTxOptions(policy, keyHashes).signingKeys));
      minted.push(...batches[index]);
      if (index < batches.length - 1) {
        onProgress?.({ batch: index + 1, batches: batches.length, state: "waiting" });
        await waitUntilSpent(connection, tx);
      }
    }
  } catch (error) {
    if (txHashes.length > 0) throw new PartialMintError(txHashes, minted, error);
    throw error;
  }
  return txHashes;
}

/** What a mint takes from the wallet and what the wallet has to hold for it, in lovelace. */
export interface MintCosts {
  /** Stays with the reference NFTs of CIP-68, one output per token. Wallets show it as spent, burning a token brings its share back. */
  deposit: number;
  fee: number;
  /** Minimum of ADA beside the minted tokens and the other tokens of the wallet, which stays in the wallet */
  kept: number;
  /** All of the above */
  needed: number;
  /** What the wallet holds */
  held: number;
  /** Transactions the mint takes, each signed on its own */
  transactions: number;
}

export async function mintCosts(connection: WalletConnection, policy: MintPolicy, tokens: MintToken[], keyHashes: string[], format: MintFormat = "cip68"): Promise<MintCosts> {
  const [changeAddress, utxos] = await Promise.all([walletChangeAddress(connection), walletUtxos(connection)]);
  const batches = mintBatches(policy, tokens, keyHashes, changeAddress, format);
  const needs = batches.map((batch) => transactionNeeds(mintConfigure(policy, batch, keyHashes, changeAddress, format), utxos, changeAddress));
  let fee = needs.reduce((sum, need) => sum + need.fee, 0);
  if (batches.length === 1) {
    // the fee of the transaction as it would be signed; the estimate stands in while the wallet holds too little to build it
    fee = await buildTransaction(connection, mintConfigure(policy, batches[0], keyHashes, changeAddress, format), utxos, policyTxOptions(policy, keyHashes).signerKeyHash)
      .then((tx) => Number(tx.body().fee().to_str()))
      .catch(() => fee);
  }
  const address = referenceAddress(changeAddress, referenceKeyHash(policy, keyHashes, changeAddress));
  const policyHash = policyScript(policy).hash();
  const deposit = format === "cip68" ? tokens.reduce((sum, token) => sum + Number(referenceOutput(address, policyHash, token).amount().coin().to_str()), 0) : 0;
  // every transaction leaves its tokens in an output of their own, the change with the other tokens is there once
  const kept = needs.reduce((sum, need) => sum + need.spent, 0) - deposit + needs[0].changeMinimum;
  return { deposit, fee, kept, needed: deposit + fee + kept, held: needs[0].offered, transactions: batches.length };
}
