import { COINS_PER_UTXO_BYTE, currentSlot, hexToBytes, sendTransaction, toNativeScript, TTL_SECONDS, TxOptions, walletChangeAddress } from "@cardano/transaction";
import { MintPolicy, MintToken, SimpleScript, TokenDetails, WalletConnection } from "@cardano/types";
import { MetaValue, tokenMetadata } from "@cardano/metadata";
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

export function createPolicy(keyHash: string, days: number): MintPolicy {
  const script: SimpleScript = {
    type: "all",
    scripts: [
      { type: "sig", keyHash },
      { type: "before", slot: Math.floor(currentSlot()) + days * 24 * 60 * 60 },
    ],
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

/** Sets validity and required signer so the policy script validates. */
export function applyPolicy(txBuilder: TransactionBuilder, policy: MintPolicy, keyHashes: string[]) {
  const dueSlot = policyDueSlot(policy);
  if (dueSlot != null) {
    txBuilder.set_ttl(Math.min(currentSlot() + TTL_SECONDS, dueSlot));
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

export async function mintTokens(connection: WalletConnection, policy: MintPolicy, tokens: MintToken[], keyHashes: string[]) {
  const changeAddress = await walletChangeAddress(connection);
  const script = policyScript(policy);
  const policyHash = script.hash();
  const referenceOutputAddress = referenceAddress(changeAddress, referenceKeyHash(policy, keyHashes, changeAddress));
  const dataCost = DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE);

  return sendTransaction(
    connection,
    (txBuilder) => {
      const mintBuilder = MintBuilder.new();
      const witness = MintWitness.new_native_script(NativeScriptSource.new(script));
      const userAssets = MultiAsset.new();

      for (const token of tokens) {
        const assetName = token.assetName;
        const referenceName = labeledAssetName(REFERENCE_LABEL, assetName);
        const userName = labeledAssetName(token.standard, assetName);

        mintBuilder.add_asset(witness, referenceName, Int.new_i32(1));
        mintBuilder.add_asset(witness, userName, Int.from_str(token.amount));

        const referenceAsset = MultiAsset.new();
        referenceAsset.set_asset(policyHash, referenceName, BigNum.one());
        txBuilder.add_output(
          TransactionOutputBuilder.new()
            .with_address(referenceOutputAddress)
            .with_plutus_data(tokenDatum(token))
            .next()
            .with_asset_and_min_required_coin_by_utxo_cost(referenceAsset, dataCost)
            .build()
        );

        userAssets.set_asset(policyHash, userName, BigNum.from_str(token.amount));
      }

      txBuilder.add_output(
        TransactionOutputBuilder.new().with_address(changeAddress).next().with_asset_and_min_required_coin_by_utxo_cost(userAssets, dataCost).build()
      );
      txBuilder.set_mint_builder(mintBuilder);
      applyPolicy(txBuilder, policy, keyHashes);
    },
    policyTxOptions(policy, keyHashes)
  );
}
