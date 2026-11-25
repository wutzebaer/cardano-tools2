// Runs the site's own transaction code (app/cardano/dropTx.ts) against the preview testnet with a throwaway key.
//
//   node --import ./site-hooks.mjs site.mjs create [burnable] [royalty] [--groups N] [--total N] [--file list.json --ipfs http://host:port]
//   node --import ./site-hooks.mjs site.mjs buy <number>
//   node --import ./site-hooks.mjs site.mjs burn <number>
//   node --import ./site-hooks.mjs site.mjs close
//   node --import ./site-hooks.mjs site.mjs show
//
// With --dry a transaction is built and run by a node, but not submitted. The run prints what the scripts used,
// which is where the fixed budgets in dropTx.ts come from.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { groupOfDatum, groupOfMarker, isSold, positionOfToken, REFERENCE_LABEL, utf8Hex } from "@cardano/dropScript";
import { policyRegistration, REGISTRATION_LABEL } from "@cardano/registration";
import { BUDGET, burnTokenTx, buyTokenTx, closeGroupsTx, createDropTx, dropAddress, dropOf, GROUPS_PER_CLOSE } from "@cardano/dropTx";

const KOIOS = "https://preview.koios.rest/api/v1";
const NETWORK_ID = 0;
const STATE = new URL("./state-site.json", import.meta.url);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => (args.includes(`--${name}`) ? Number(args[args.indexOf(`--${name}`) + 1]) : fallback);
const DRY = flag("dry");

async function koios(path, body, raw) {
  const response = await fetch(KOIOS + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": raw ? "application/cbor" : "application/json" },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${text.slice(0, 1500)}`);
  return JSON.parse(text);
}

async function outputsAt(address) {
  const rows = await koios("/address_utxos", { _addresses: [address], _extended: true });
  return rows.map((row) => ({
    txHash: row.tx_hash,
    index: row.tx_index,
    lovelace: BigInt(row.value),
    tokens: (Array.isArray(row.asset_list) ? row.asset_list : []).map((asset) => ({ policyId: asset.policy_id, name: asset.asset_name ?? "", quantity: BigInt(asset.quantity) })),
    datum: row.inline_datum?.bytes,
  }));
}

const key = CSL.PrivateKey.from_normal_bytes(Buffer.from(JSON.parse(readFileSync("/keys/preview-key.json", "utf8")).privateKey, "hex"));
const wallet = CSL.EnterpriseAddress.new(NETWORK_ID, CSL.Credential.from_keyhash(key.to_public().hash())).to_address();

async function context() {
  const utxos = (await outputsAt(wallet.to_bech32())).map((output) => {
    const value = CSL.Value.new(CSL.BigNum.from_str(`${output.lovelace}`));
    if (output.tokens.length) {
      const assets = CSL.MultiAsset.new();
      for (const token of output.tokens) {
        assets.set_asset(CSL.ScriptHash.from_hex(token.policyId), CSL.AssetName.new(Buffer.from(token.name, "hex")), CSL.BigNum.from_str(`${token.quantity}`));
      }
      value.set_multiasset(assets);
    }
    return CSL.TransactionUnspentOutput.new(CSL.TransactionInput.new(CSL.TransactionHash.from_hex(output.txHash), output.index), CSL.TransactionOutput.new(wallet, value));
  });
  const [tip] = await koios("/tip");
  const parameters = await koios("/cli_protocol_params");
  // --tokens-only leaves out the outputs with only ADA, as in a wallet that has no output fit for collateral
  const offered = flag("tokens-only") ? utxos.filter((utxo) => utxo.output().amount().multiasset()) : utxos;
  return { utxos: offered, changeAddress: wallet, costModel: parameters.costModels.PlutusV3, ttlSlot: tip.abs_slot + 600 };
}

const tokensOf = (total) =>
  Array.from({ length: total }, (_, number) => ({
    assetName: `SiteDrop${number + 1}`,
    metadata: { name: `Site Drop #${number + 1}`, image: `ipfs://example/${number + 1}.png`, traits: { number: number + 1, tags: ["test", "preview"] } },
  }));

const text = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const tokensIn = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));

function state() {
  if (!existsSync(STATE)) throw new Error("no drop yet, run create first");
  const saved = JSON.parse(readFileSync(STATE, "utf8"));
  return { ...saved, drop: dropOf(saved.seed, saved.burnable), tokens: saved.file ? tokensIn(saved.file) : tokensOf(saved.total) };
}

/** Publishes a list the way the site does and answers with where it is. */
async function publish(tokens, ipfs) {
  const form = new FormData();
  form.append("file", new Blob([JSON.stringify({ version: 1, tokens })], { type: "application/json" }), "drop.json");
  const response = await fetch(`${ipfs}/api/v0/add?pin=true&cid-version=0`, { method: "POST", body: form });
  return `ipfs://${(await response.json()).Hash}`;
}

async function chainOf(drop) {
  const outputs = await outputsAt(dropAddress(drop, NETWORK_ID).to_bech32());
  const groups = [];
  const metadata = [];
  for (const output of outputs) {
    const marker = output.tokens.map((token) => (token.policyId === drop.policyId ? groupOfMarker(token.name) : undefined)).find((group) => group !== undefined);
    const group = output.datum && marker !== undefined ? groupOfDatum(output.datum) : undefined;
    if (group && group.group === marker) groups.push({ ...group, output });
    else metadata.push(output);
  }
  return { groups: groups.sort((a, b) => a.group - b.group), metadata };
}

async function send(tx, what) {
  const fixed = CSL.FixedTransaction.from_bytes(tx.to_bytes());
  fixed.sign_and_add_vkey_signature(key);
  const evaluation = await koios("/ogmios", { jsonrpc: "2.0", method: "evaluateTransaction", params: { transaction: { cbor: fixed.to_hex() } } });
  const used = evaluation.result.map((run) => `${run.validator.purpose} ${run.budget.memory} mem ${run.budget.cpu} cpu`);
  console.log(`${what}: ${tx.to_bytes().length} bytes, fee ${Number(tx.body().fee().to_str()) / 1e6} ADA, scripts used: ${[...new Set(used)].join("; ")}${used.length > 2 ? ` (${used.length} runs)` : ""}`);
  if (process.env.FEE_PARTS) {
    const prices = CSL.ExUnitPrices.new(CSL.UnitInterval.new(CSL.BigNum.from_str("577"), CSL.BigNum.from_str("10000")), CSL.UnitInterval.new(CSL.BigNum.from_str("721"), CSL.BigNum.from_str("10000000")));
    const linear = CSL.LinearFee.new(CSL.BigNum.from_str("44"), CSL.BigNum.from_str("155381"));
    const signed = CSL.Transaction.from_bytes(fixed.to_bytes());
    console.log(`  fee by size ${CSL.min_fee(signed, linear).to_str()}, by scripts ${CSL.min_script_fee(signed, prices).to_str()}, inputs ${tx.body().inputs().len()}, outputs ${tx.body().outputs().len()}`);
  }
  if (DRY) return;
  const hash = await koios("/submittx", Buffer.from(fixed.to_bytes()), true);
  console.log(`${what}: submitted ${hash}`);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if ((await outputsAt(wallet.to_bech32())).some((output) => output.txHash === hash)) break;
  }
  console.log(`${what}: confirmed`);
}

const [command] = args;
if (command === "create") {
  const file = text("file");
  const tokens = file ? tokensIn(file) : tokensOf(option("total", 5));
  const total = tokens.length;
  const groups = option("groups", 2);
  const burnable = args.includes("burnable");
  const list = file ? await publish(tokens, text("ipfs")) : "ipfs://QmExampleExampleExampleExampleExampleExample00";
  // CIP-27 metadata: 5 % to the wallet, the address in pieces of 64 characters
  const royalty = args.includes("royalty") ? { rate: "0.05", addr: wallet.to_bech32().match(/.{1,64}/g) } : undefined;
  const { tx, drop, config } = createDropTx(await context(), NETWORK_ID, { tokens, groups, price: 5_000_000n, burnable, list, royalty });
  console.log(`policy ${drop.policyId}, ${total} tokens in ${groups} groups, burnable ${burnable}, budget ${JSON.stringify(BUDGET.create(groups))}`);
  if (!DRY) writeFileSync(STATE, JSON.stringify({ seed: config.seed, burnable, total, file }));
  await send(tx, "create");
} else if (command === "register") {
  // A policy of the throwaway key that mints its royalty token with a collection name, the way the mint page does.
  // --slot N makes a policy of its own, "all [sig, after N]".
  const { utxos, ttlSlot } = await context();
  const scripts = CSL.NativeScripts.new();
  scripts.add(CSL.NativeScript.new_script_pubkey(CSL.ScriptPubkey.new(key.to_public().hash())));
  scripts.add(CSL.NativeScript.new_timelock_start(CSL.TimelockStart.new_timelockstart(CSL.BigNum.from_str(`${option("slot", ttlSlot - 4200)}`))));
  const script = CSL.NativeScript.new_script_all(CSL.ScriptAll.new(scripts));
  const policyId = script.hash().to_hex();
  const royalty = { rate: "0.05", addr: wallet.to_bech32().match(/.{1,64}/g) };
  const name = text("name") ?? "Preview Robots";
  const builder = CSL.TransactionBuilder.new(
    CSL.TransactionBuilderConfigBuilder.new()
      .fee_algo(CSL.LinearFee.new(CSL.BigNum.from_str("44"), CSL.BigNum.from_str("155381")))
      .pool_deposit(CSL.BigNum.from_str("500000000"))
      .key_deposit(CSL.BigNum.from_str("2000000"))
      .coins_per_utxo_byte(CSL.BigNum.from_str("4310"))
      .max_value_size(5000)
      .max_tx_size(16384)
      .build()
  );
  const mint = CSL.MintBuilder.new();
  mint.add_asset(CSL.MintWitness.new_native_script(CSL.NativeScriptSource.new(script)), CSL.AssetName.new(new Uint8Array()), CSL.Int.new_i32(1));
  builder.set_mint_builder(mint);
  const asset = CSL.MultiAsset.new();
  asset.set_asset(script.hash(), CSL.AssetName.new(new Uint8Array()), CSL.BigNum.one());
  builder.add_output(CSL.TransactionOutputBuilder.new().with_address(wallet).next().with_asset_and_min_required_coin_by_utxo_cost(asset, CSL.DataCost.new_coins_per_byte(CSL.BigNum.from_str("4310"))).build());
  builder.add_json_metadatum_with_schema(CSL.BigNum.from_str("777"), JSON.stringify(royalty), CSL.MetadataJsonSchema.NoConversions);
  const registration = policyRegistration({ policyId, scriptCbor: script.to_hex(), name, description: text("description"), image: text("image"), royalty, nonce: ttlSlot });
  builder.add_json_metadatum_with_schema(CSL.BigNum.from_str(`${REGISTRATION_LABEL}`), JSON.stringify(registration), CSL.MetadataJsonSchema.DetailedSchema);
  builder.set_validity_start_interval_bignum(CSL.BigNum.from_str(`${ttlSlot - 700}`));
  builder.set_ttl_bignum(CSL.BigNum.from_str(`${ttlSlot}`));
  const inputs = CSL.TransactionUnspentOutputs.new();
  utxos.filter((utxo) => !utxo.output().amount().multiasset()).forEach((utxo) => inputs.add(utxo));
  builder.add_inputs_from(inputs, CSL.CoinSelectionStrategyCIP2.LargestFirstMultiAsset);
  builder.add_change_if_needed(wallet);
  console.log(`policy ${policyId}, collection "${name}"`);
  await send(builder.build_tx(), "register");
} else if (command === "buy") {
  const { drop, tokens } = state();
  const index = Number(args[1]);
  const { groups } = await chainOf(drop);
  const group = groups.find((found) => found.group === index % found.config.groups);
  if (!group) throw new Error("the group of this token is closed");
  await send(buyTokenTx(await context(), NETWORK_ID, drop, group, tokens, index), `buy ${index}`);
} else if (command === "burn") {
  const { drop, tokens } = state();
  const token = tokens[Number(args[1])];
  const metadata = (await chainOf(drop)).metadata.find((output) => output.tokens.some((held) => held.name === REFERENCE_LABEL + utf8Hex(token.assetName)));
  if (!metadata) throw new Error("no metadata of this token at the script");
  await send(burnTokenTx(await context(), drop, metadata, token.assetName), `burn ${args[1]}`);
} else if (command === "close") {
  const { drop } = state();
  for (;;) {
    const { groups } = await chainOf(drop);
    if (groups.length === 0) break;
    await send(closeGroupsTx(await context(), drop, groups.slice(0, GROUPS_PER_CLOSE)), `close ${Math.min(groups.length, GROUPS_PER_CLOSE)} of ${groups.length} groups`);
    if (DRY) break;
  }
} else if (command === "show") {
  const { drop, tokens } = state();
  const { groups, metadata } = await chainOf(drop);
  console.log(`policy ${drop.policyId}`);
  for (const group of groups) {
    const sold = tokens.flatMap((token, index) => (index % group.config.groups === group.group && isSold(group.sold, positionOfToken(index, group.config.groups)) ? [index] : []));
    console.log(`  group ${group.group}: ${Number(group.output.lovelace) / 1e6} ADA, sold ${sold.join(", ") || "nothing"}, price ${group.config.price}, list ${group.config.list}`);
  }
  console.log(`  metadata outputs: ${metadata.length}, ${metadata.map((output) => Number(output.lovelace) / 1e6).join(" + ") || 0} ADA`);
  const mine = await outputsAt(wallet.to_bech32());
  const held = mine.flatMap((output) => output.tokens).filter((token) => token.policyId === drop.policyId);
  console.log(`wallet: ${Number(mine.reduce((sum, output) => sum + output.lovelace, 0n)) / 1e6} ADA, tokens of the drop: ${held.map((token) => Buffer.from(token.name.slice(8), "hex")).join(", ") || "none"}`);
} else console.log("commands: create [burnable] [--groups N] [--total N], buy <number>, burn <number>, close, show; --dry builds and runs without submitting");
