import { COINS_PER_UTXO_BYTE, currentSlot, sendTransaction, unixToSlot } from "@cardano/transaction";
import { MintPolicy, MintToken, WalletConnection } from "@cardano/types";
import { crc8 } from "@cardano/utils";
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
  NativeScripts,
  NativeScriptSource,
  PlutusData,
  PlutusList,
  PlutusMap,
  PlutusMapValues,
  ScriptAll,
  ScriptPubkey,
  TimelockExpiry,
  TransactionOutputBuilder,
} from "@emurgo/cardano-serialization-lib-browser";

const REFERENCE_LABEL = 100;
const LABEL_BYTES = 4;
/** Asset names are limited to 32 bytes, the CIP-67 label takes 4 of them. */
export const ASSET_NAME_MAX_BYTES = 32 - LABEL_BYTES;

export const utf8Bytes = (text: string) => new TextEncoder().encode(text);

const hexToBytes = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

// ---------------------------------------------------------------------------
// Policy: derived from the wallet's payment key, nothing secret to store
// ---------------------------------------------------------------------------

export function paymentKeyHash(changeAddressHex: string) {
  return Address.from_bytes(hexToBytes(changeAddressHex)).payment_cred()!.to_keyhash()!.to_hex();
}

export function policyScript(policy: Pick<MintPolicy, "keyHash" | "dueSlot">): NativeScript {
  const scripts = NativeScripts.new();
  scripts.add(NativeScript.new_script_pubkey(ScriptPubkey.new(Ed25519KeyHash.from_hex(policy.keyHash))));
  scripts.add(NativeScript.new_timelock_expiry(TimelockExpiry.new(policy.dueSlot)));
  return NativeScript.new_script_all(ScriptAll.new(scripts));
}

export function policyForLockYear(keyHash: string, lockYear: number): MintPolicy {
  const dueSlot = Math.floor(unixToSlot(Date.UTC(lockYear + 1, 0, 1) / 1000));
  return { lockYear, keyHash, dueSlot, policyId: policyScript({ keyHash, dueSlot }).hash().to_hex() };
}

export function walletPolicies(keyHash: string) {
  const currentYear = new Date().getUTCFullYear();
  return Array.from({ length: 26 }, (_, i) => policyForLockYear(keyHash, currentYear + i));
}

export function policySecondsLeft(policy: MintPolicy) {
  return policy.dueSlot - currentSlot();
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

export function tokenMetadataEntries(token: MintToken): [string, string | number][] {
  const entries: [string, string | number][] = [["name", token.name]];
  if (token.standard === 222) {
    entries.push(["image", token.image]);
    if (token.mediaType) entries.push(["mediaType", token.mediaType]);
  }
  if (token.description) entries.push(["description", token.description]);
  if (token.standard === 333) {
    if (token.ticker) entries.push(["ticker", token.ticker]);
    if (token.url) entries.push(["url", token.url]);
    if (token.decimals) entries.push(["decimals", Number(token.decimals)]);
    if (token.image) entries.push(["logo", token.image]);
  }
  for (const { key, value } of token.properties) {
    if (key) entries.push([key, value]);
  }
  return entries;
}

function metadataValue(value: string | number) {
  return typeof value === "number" ? PlutusData.new_integer(CslBigInt.from_str(`${value}`)) : PlutusData.new_bytes(utf8Bytes(value));
}

/** `Constr 0 [metadata, version = 1, extra = Constr 0 []]` */
export function tokenDatum(token: MintToken): PlutusData {
  const metadata = PlutusMap.new();
  for (const [key, value] of tokenMetadataEntries(token)) {
    const values = PlutusMapValues.new();
    values.add(metadataValue(value));
    metadata.insert(PlutusData.new_bytes(utf8Bytes(key)), values);
  }
  const fields = PlutusList.new();
  fields.add(PlutusData.new_map(metadata));
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
  const lockScript = NativeScript.new_script_pubkey(ScriptPubkey.new(Ed25519KeyHash.from_hex(keyHash)));
  const payment = Credential.from_scripthash(lockScript.hash());
  const stake = BaseAddress.from_address(changeAddress)?.stake_cred();
  const network = changeAddress.network_id();
  return stake ? BaseAddress.new(network, payment, stake).to_address() : EnterpriseAddress.new(network, payment).to_address();
}

export async function mintTokens(connection: WalletConnection, policy: MintPolicy, tokens: MintToken[]) {
  const changeAddress = Address.from_bytes(hexToBytes(await connection.getChangeAddress()));
  const script = policyScript(policy);
  const policyHash = script.hash();
  const referenceOutputAddress = referenceAddress(changeAddress, policy.keyHash);
  const dataCost = DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE);

  return sendTransaction(connection, (txBuilder) => {
    const mintBuilder = MintBuilder.new();
    const witness = MintWitness.new_native_script(NativeScriptSource.new(script));
    const userAssets = MultiAsset.new();

    for (const token of tokens) {
      const referenceName = labeledAssetName(REFERENCE_LABEL, token.assetName);
      const userName = labeledAssetName(token.standard, token.assetName);

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
    txBuilder.add_required_signer(Ed25519KeyHash.from_hex(policy.keyHash));
  });
}