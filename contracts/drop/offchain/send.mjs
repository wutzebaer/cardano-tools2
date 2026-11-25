// Sends test ADA from the throwaway key to an address on the preview testnet.
//
//   node send.mjs <address> <ada> [<ada> ...]     one output per amount
import { readFileSync } from "node:fs";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";

const KOIOS = "https://preview.koios.rest/api/v1";
const [target, ...amounts] = process.argv.slice(2);
const big = (value) => CSL.BigNum.from_str(`${value}`);

async function koios(path, body, raw) {
  const response = await fetch(KOIOS + path, { method: body === undefined ? "GET" : "POST", headers: { "content-type": raw ? "application/cbor" : "application/json" }, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const key = CSL.PrivateKey.from_normal_bytes(Buffer.from(JSON.parse(readFileSync("/keys/preview-key.json", "utf8")).privateKey, "hex"));
const wallet = CSL.EnterpriseAddress.new(0, CSL.Credential.from_keyhash(key.to_public().hash())).to_address();
const to = CSL.Address.from_bech32(target);
if (to.network_id() !== 0) throw new Error("not a testnet address");

// the output with the most ADA, whatever tokens it holds: they return with the change
const utxos = await koios("/address_utxos", { _addresses: [wallet.to_bech32()], _extended: true });
const source = utxos.reduce((a, b) => (BigInt(a.value) >= BigInt(b.value) ? a : b));
const sourceValue = CSL.Value.new(big(source.value));
if (Array.isArray(source.asset_list) && source.asset_list.length > 0) {
  const assets = CSL.MultiAsset.new();
  for (const asset of source.asset_list) assets.set_asset(CSL.ScriptHash.from_hex(asset.policy_id), CSL.AssetName.new(Buffer.from(asset.asset_name ?? "", "hex")), big(asset.quantity));
  sourceValue.set_multiasset(assets);
}
const [tip] = await koios("/tip");

const builder = CSL.TransactionBuilder.new(
  CSL.TransactionBuilderConfigBuilder.new().fee_algo(CSL.LinearFee.new(big(44), big(155381))).coins_per_utxo_byte(big(4310)).pool_deposit(big(500000000)).key_deposit(big(2000000)).max_value_size(5000).max_tx_size(16384).build(),
);
builder.set_ttl_bignum(big(tip.abs_slot + 600));
builder.add_regular_input(wallet, CSL.TransactionInput.new(CSL.TransactionHash.from_hex(source.tx_hash), source.tx_index), sourceValue);
for (const ada of amounts) builder.add_output(CSL.TransactionOutput.new(to, CSL.Value.new(big(Math.round(Number(ada) * 1e6)))));
builder.add_change_if_needed(wallet);
const fixed = CSL.FixedTransaction.from_bytes(builder.build_tx().to_bytes());
fixed.sign_and_add_vkey_signature(key);
console.log(`sent ${amounts.join(" + ")} ADA: ${await koios("/submittx", Buffer.from(fixed.to_bytes()), true)}`);
