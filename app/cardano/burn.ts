import { WalletAsset } from "@cardano/assets";
import { getUtxos } from "@cardano/dbsync";
import { IS_MAINNET, NETWORK } from "@cardano/network";
import { applyPolicy, cip67LabelBytes, policyScript, policyTxOptions, referenceAddress, referenceKeyHash } from "@cardano/mint";
import { hexToBytes, sendTransaction, walletChangeAddress, walletUtxos } from "@cardano/transaction";
import { MintPolicy, WalletConnection } from "@cardano/types";
import { cip67Label } from "@cardano/utils";
import {
  AssetName,
  BigNum,
  Credential,
  Ed25519KeyHash,
  EnterpriseAddress,
  Int,
  MintBuilder,
  MintWitness,
  MultiAsset,
  NativeScript,
  NativeScriptSource,
  NativeScripts,
  ScriptAll,
  ScriptPubkey,
  TimelockExpiry,
  TransactionHash,
  TransactionInput,
  Value,
} from "@emurgo/cardano-serialization-lib-browser";

/** Nothing sent here ever comes out again: `all [before slot 0]` can never validate. Often called a burn address, but the tokens stay in the supply. */
function deadAddress() {
  const scripts = NativeScripts.new();
  scripts.add(NativeScript.new_timelock_expiry(TimelockExpiry.new_timelockexpiry(BigNum.zero())));
  const script = NativeScript.new_script_all(ScriptAll.new(scripts));
  return EnterpriseAddress.new(NETWORK.id, Credential.from_scripthash(script.hash())).to_address().to_bech32();
}

/** On mainnet the well known address, on testnets the address of the same script. */
export const DEAD_ADDRESS = IS_MAINNET ? "addr1wxa7ec20249sqg87yu2aqkqp735qa02q6yd93u28gzul93ghspjnt" : deadAddress();

export interface BurnItem {
  asset: WalletAsset;
  amount: bigint;
  /** CIP-68 reference NFT to burn along, which also frees the ADA locked with it. */
  reference?: ReferenceUtxo;
}

export interface ReferenceUtxo {
  txHash: string;
  txIndex: number;
  lovelace: number;
  /** Asset name (hex) of the reference NFT */
  name: string;
}

const REFERENCE_PREFIX = Buffer.from(cip67LabelBytes(100)).toString("hex");

/** Asset name (hex) of the CIP-68 reference NFT belonging to a user token, if it is one. */
export function referenceNameFor(name: string) {
  const label = cip67Label(name);
  return label != null && label !== 100 ? REFERENCE_PREFIX + name.slice(8) : undefined;
}

/**
 * Reference NFTs of this policy that we locked at mint time and can therefore take back.
 * Only UTxOs holding nothing but the reference NFT are returned.
 */
export async function findReferenceUtxos(connection: WalletConnection, policy: MintPolicy, keyHashes: string[]): Promise<Map<string, ReferenceUtxo>> {
  const changeAddress = await walletChangeAddress(connection);
  const address = referenceAddress(changeAddress, referenceKeyHash(policy, keyHashes, changeAddress)).to_bech32();
  const rows = await getUtxos(address);

  const byUtxo = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.txHash}#${row.txIndex}`;
    byUtxo.set(key, [...(byUtxo.get(key) ?? []), row]);
  }
  const references = new Map<string, ReferenceUtxo>();
  for (const utxoRows of byUtxo.values()) {
    const assets = utxoRows.filter((row) => row.maPolicyId);
    const lovelace = utxoRows.find((row) => !row.maPolicyId);
    if (assets.length !== 1 || !lovelace || assets[0].maPolicyId !== policy.policyId || assets[0].value !== 1 || assets[0].owningAddress !== address) {
      continue;
    }
    const name = assets[0].maName ?? "";
    references.set(name, { txHash: lovelace.txHash, txIndex: lovelace.txIndex, lovelace: lovelace.value, name });
  }
  return references;
}

/** Burns tokens of one policy. Needs the policy to be signable and not locked yet. */
export async function burnTokens(connection: WalletConnection, policy: MintPolicy, items: BurnItem[], keyHashes: string[]) {
  const script = policyScript(policy);
  const changeAddress = await walletChangeAddress(connection);
  const lockKeyHash = referenceKeyHash(policy, keyHashes, changeAddress);
  const lockScript = NativeScript.new_script_pubkey(ScriptPubkey.new(Ed25519KeyHash.from_hex(lockKeyHash)));

  // the UTxOs holding the tokens have to be inputs, coin selection only cares about what the outputs need
  const tokenInputs = new Map(items.flatMap((item) => item.asset.utxos).map((utxo) => [utxo.input().to_hex(), utxo]));
  const otherUtxos = (await walletUtxos(connection)).filter((utxo) => !tokenInputs.has(utxo.input().to_hex()));

  return sendTransaction(
    connection,
    (txBuilder) => {
      const mintBuilder = MintBuilder.new();
      const witness = MintWitness.new_native_script(NativeScriptSource.new(script));

      for (const utxo of tokenInputs.values()) {
        txBuilder.add_regular_input(utxo.output().address(), utxo.input(), utxo.output().amount());
      }

      for (const { asset, amount, reference } of items) {
        mintBuilder.add_asset(witness, AssetName.new(hexToBytes(asset.name)), Int.new_negative(BigNum.from_str(`${amount}`)));

        if (reference) {
          const referenceName = AssetName.new(hexToBytes(reference.name));
          const value = Value.new(BigNum.from_str(`${reference.lovelace}`));
          const multiAsset = MultiAsset.new();
          multiAsset.set_asset(script.hash(), referenceName, BigNum.one());
          value.set_multiasset(multiAsset);
          txBuilder.add_native_script_input(lockScript, TransactionInput.new(TransactionHash.from_hex(reference.txHash), reference.txIndex), value);
          txBuilder.add_required_signer(Ed25519KeyHash.from_hex(lockKeyHash));
          mintBuilder.add_asset(witness, referenceName, Int.new_negative(BigNum.one()));
        }
      }

      txBuilder.set_mint_builder(mintBuilder);
      applyPolicy(txBuilder, policy, keyHashes);
    },
    // the key that locks the reference tokens has to sign as well, for a wallet-key policy it is the policy's key
    { ...policyTxOptions(policy, keyHashes), signerKeyHash: lockKeyHash, utxos: otherUtxos }
  );
}
