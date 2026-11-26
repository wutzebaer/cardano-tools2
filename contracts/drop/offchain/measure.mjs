// Measures what the drop contract uses, without a chain: builds the transactions with the site's own code
// (app/cardano/dropTx.ts) from made-up outputs and runs their scripts with the same machine a node uses.
// This is where the budgets in dropTx.ts come from, and it fails if one of them is too small.
//
//   node --import ./site-hooks.mjs measure.mjs            checks the budgets, prints the worst cases
//   node --import ./site-hooks.mjs measure.mjs --table    prints every case
//
// The cost model is read from Koios (mainnet), nothing else touches the network.
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { eval_phase_two_raw } from "@lucid-evolution/uplc";
import { groupOfDatum, MAX_METADATA_BYTES, metadataDatum, suggestedGroups, USER_LABEL, utf8Hex } from "@cardano/dropScript";
import { burnBudgets, buyBudgets, burnTokensTx, buyTokenTx, closeBudgets, closeGroupsTx, createBudget, createDropTx, dropAddress, GROUPS_PER_CLOSE, MAX_BURNS, MAX_WALLET_INPUTS } from "@cardano/dropTx";
import { DEFAULT_PROTOCOL_PARAMS } from "@cardano/protocol";

const TABLE = process.argv.includes("--table");
/** A budget has to leave this much room above what was measured: a real transaction has other inputs and outputs. */
const MARGIN = 1.1;

const parameters = await (await fetch("https://api.koios.rest/api/v1/cli_protocol_params")).json();
// the machine of this library knows the first 297 costs of Plutus V3; the chain has added costs for newer
// builtins since, which the contract does not use
const costModel = parameters.costModels.PlutusV3.slice(0, 297);

const big = (value) => CSL.BigNum.from_str(`${value}`);
const key = CSL.PrivateKey.generate_ed25519();
const wallet = CSL.EnterpriseAddress.new(1, CSL.Credential.from_keyhash(key.to_public().hash())).to_address();

let made = 0;
const fakeHash = () => (++made).toString(16).padStart(64, "0");
const utxo = (txHash, index, output) => CSL.TransactionUnspentOutput.new(CSL.TransactionInput.new(CSL.TransactionHash.from_hex(txHash), index), output);
const adaOutputs = (count, lovelace = 200_000_000) => Array.from({ length: count }, () => utxo(fakeHash(), 0, CSL.TransactionOutput.new(wallet, CSL.Value.new(big(lovelace)))));
const context = (utxos) => ({ utxos, changeAddress: wallet, costModel, ttlSlot: 200_000_000, params: DEFAULT_PROTOCOL_PARAMS });

function costModels() {
  const model = CSL.CostModel.new();
  costModel.forEach((cost, operation) => model.set(operation, cost < 0 ? CSL.Int.new_negative(big(-cost)) : CSL.Int.new(big(cost))));
  const models = CSL.Costmdls.new();
  models.insert(CSL.Language.new_plutus_v3(), model);
  return models;
}

/** Runs the scripts of a transaction against the outputs it spends and answers with what each run used. */
function run(tx, spent) {
  const redeemers = eval_phase_two_raw(
    tx.to_bytes(),
    spent.map((output) => output.input().to_bytes()),
    spent.map((output) => output.output().to_bytes()),
    costModels().to_bytes(),
    BigInt(DEFAULT_PROTOCOL_PARAMS.maxTxExSteps),
    BigInt(DEFAULT_PROTOCOL_PARAMS.maxTxExMem),
    1596059091000n,
    4492800n,
    1000
  );
  return redeemers.map((bytes) => {
    const redeemer = CSL.Redeemer.from_bytes(bytes);
    return { spend: redeemer.tag().kind() === CSL.RedeemerTagKind.Spend, mem: Number(redeemer.ex_units().mem().to_str()), steps: Number(redeemer.ex_units().steps().to_str()) };
  });
}

const hashOf = (tx) => CSL.FixedTransaction.from_bytes(tx.to_bytes()).transaction_hash().to_hex();

/** The outputs of a transaction as the chain would hold them afterwards. */
function outputsOf(tx) {
  const txHash = hashOf(tx);
  const outputs = tx.body().outputs();
  return Array.from({ length: outputs.len() }, (_, index) => utxo(txHash, index, outputs.get(index)));
}

/** An output at the contract in the form the site reads it from the API. */
function dropOutput(output) {
  const tokens = [];
  const assets = output.output().amount().multiasset();
  const policies = assets?.keys();
  for (let p = 0; p < (policies?.len() ?? 0); p++) {
    const names = assets.get(policies.get(p)).keys();
    for (let n = 0; n < names.len(); n++) {
      tokens.push({ policyId: policies.get(p).to_hex(), name: Buffer.from(names.get(n).name()).toString("hex"), quantity: BigInt(assets.get(policies.get(p)).get(names.get(n)).to_str()) });
    }
  }
  return {
    txHash: output.input().transaction_id().to_hex(),
    index: output.input().index(),
    lovelace: BigInt(output.output().amount().coin().to_str()),
    tokens,
    datum: output.output().plutus_data()?.to_hex(),
  };
}

/** A list of tokens, one of them with metadata of about the given size. */
function tokensOf(total, heavy, metadataBytes) {
  const filler = (bytes) => Object.fromEntries(Array.from({ length: Math.ceil(bytes / 80) }, (_, n) => [`attribute${String(n).padStart(4, "0")}`, "x".repeat(60)]));
  return Array.from({ length: total }, (_, number) => ({
    assetName: `Token${String(number + 1).padStart(5, "0")}`,
    metadata: { name: `Token #${number + 1}`, image: "ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG", mediaType: "image/png", ...(number === heavy ? filler(metadataBytes) : {}) },
  }));
}

const worst = {};
const failures = [];
function record(what, detail, used, budget) {
  if (TABLE) console.log(`${what.padEnd(12)} ${detail.padEnd(46)} used ${String(used.mem).padStart(9)} mem ${String(used.steps).padStart(12)} steps   budget ${String(budget.mem).padStart(9)} / ${String(budget.steps).padStart(12)}`);
  const share = Math.max(used.mem / budget.mem, used.steps / budget.steps);
  if (!worst[what] || share > worst[what].share) worst[what] = { share, detail, used, budget };
  if (share * MARGIN > 1) failures.push(`${what} (${detail}): used ${used.mem} mem / ${used.steps} steps of ${budget.mem} / ${budget.steps}`);
}

/** Creates a drop and answers with what is on the chain afterwards. */
function create(tokens, groups, burnable, withRoyalty, { price = 10_000_000n, funds = adaOutputs(4) } = {}) {
  const { tx, drop, config } = createDropTx(context(funds), 1, {
    tokens,
    groups,
    price,
    burnable,
    list: `ipfs://${"Q".repeat(46)}`,
    royalty: withRoyalty ? { rate: "0.05", addr: wallet.to_bech32() } : undefined,
    collection: withRoyalty ? { name: "A collection", description: "x".repeat(500) } : undefined,
  });
  const [used] = run(tx, funds);
  record("create", `${groups} groups${withRoyalty ? ", royalties and collection" : ""}, ${tx.body().inputs().len()} inputs`, used, createBudget(groups, tx.body().inputs().len()));
  const address = dropAddress(drop, 1).to_hex();
  const outputs = outputsOf(tx);
  const groupOutputs = outputs.filter((output) => output.output().address().to_hex() === address);
  return { drop, config, tokens, groups: groupOutputs.map((output) => ({ ...groupOfDatum(output.output().plutus_data().to_hex()), output: dropOutput(output), utxo: output })) };
}

/** Buys a token and answers with the outputs the purchase leaves. */
function buy(chain, index, detail, funds = adaOutputs(3)) {
  const group = chain.groups.find((candidate) => candidate.group === index % chain.config.groups);
  const tx = buyTokenTx(context(funds), 1, chain.drop, group, chain.tokens, index);
  const runs = run(tx, [...funds, group.utxo]);
  const budgets = buyBudgets(chain.tokens[index], chain.config, tx.body().inputs().len());
  detail += `, ${tx.body().inputs().len()} inputs`;
  record("buy spend", detail, runs.find((used) => used.spend), budgets.spend);
  record("buy mint", detail, runs.find((used) => !used.spend), budgets.mint);
  const outputs = outputsOf(tx);
  const user = USER_LABEL + utf8Hex(chain.tokens[index].assetName);
  return {
    size: tx.to_bytes().length,
    metadata: outputs[1],
    holder: outputs.find((output) => dropOutput(output).tokens.some((token) => token.name === user)),
    assetName: chain.tokens[index].assetName,
  };
}

// --- create: every number of groups, with and without the royalty token
for (const groups of [1, 2, 8, 16, 32]) {
  create(tokensOf(Math.max(groups, 5), -1, 0), groups, false, false);
  create(tokensOf(Math.max(groups, 5), -1, 0), groups, true, true);
}

// --- buy: small and large drops, light and heavy metadata, the first and the last token of a group
for (const total of [1, 5, 100, 1000, 10000]) {
  for (const metadataBytes of [0, 1000, 3000, 6000, 7900]) {
    const heavy = total - 1;
    const chain = create(tokensOf(total, heavy, metadataBytes), suggestedGroups(total), false, false);
    const datumBytes = metadataDatum(chain.tokens[heavy]).length / 2;
    if (datumBytes > MAX_METADATA_BYTES) throw new Error(`the case of ${metadataBytes} bytes makes ${datumBytes}, more than a list may hold`);
    try {
      const bought = buy(chain, heavy, `${total} tokens, metadata ${datumBytes} bytes`);
      if (TABLE) console.log(`             transaction ${bought.size} bytes`);
    } catch (error) {
      failures.push(`buy of ${total} tokens with ${datumBytes} bytes of metadata cannot be built: ${error?.message ?? error}`);
    }
  }
}
// one group for all tokens: the longest record of what is sold
{
  const chain = create(tokensOf(10000, 9999, 0), 1, false, false);
  buy(chain, 9999, "10000 tokens in one group");
}
// a wallet of many small outputs: the transaction spends as many as the site allows, and every run looks through them
{
  const small = () => adaOutputs(MAX_WALLET_INPUTS + 30, 3_000_000);
  create(tokensOf(32, -1, 0), 32, true, true, { funds: small() });
  for (const metadataBytes of [0, 4000]) {
    const chain = create(tokensOf(10000, 9999, metadataBytes), suggestedGroups(10000), false, false, { price: 320_000_000n });
    const bought = buy(chain, 9999, `10000 tokens, metadata about ${metadataBytes} bytes, small outputs`, small());
    if (TABLE) console.log(`             transaction ${bought.size} bytes`);
  }
}

// --- burn: one to the most tokens at once, light and heavy metadata
for (const metadataBytes of [0, 3000]) {
  for (const count of [1, 2, 5, MAX_BURNS]) {
    const chain = create(tokensOf(40, -1, 0).map((token, number) => (number < count ? tokensOf(40, number, metadataBytes)[number] : token)), suggestedGroups(40), true, false);
    const bought = Array.from({ length: count }, (_, index) => buy(chain, index, `for the burn of ${count}`));
    const funds = adaOutputs(3);
    const items = bought.map((purchase) => ({ metadata: dropOutput(purchase.metadata), assetName: purchase.assetName }));
    let tx;
    try {
      tx = burnTokensTx(context([...funds, ...bought.map((purchase) => purchase.holder)]), chain.drop, items);
    } catch (error) {
      failures.push(`burn of ${count} with ${metadataBytes} bytes of metadata each cannot be built: ${error?.message ?? error}`);
      continue;
    }
    const runs = run(tx, [...funds, ...bought.map((purchase) => purchase.holder), ...bought.map((purchase) => purchase.metadata)]);
    const budgets = burnBudgets(count);
    const detail = `${count} tokens, metadata about ${metadataBytes} bytes each`;
    for (const used of runs.filter((used) => used.spend)) record("burn spend", detail, used, budgets.spend);
    record("burn mint", detail, runs.find((used) => !used.spend), budgets.mint);
  }
}

// --- close: one group to the most at once, of the largest drop
for (const count of [1, 4, GROUPS_PER_CLOSE]) {
  const chain = create(tokensOf(10000, -1, 0), 32, false, false);
  const closing = chain.groups.slice(0, count);
  const funds = adaOutputs(3);
  // the owner signs, which the machine does not check: the transaction names the key
  const tx = closeGroupsTx(context(funds), chain.drop, closing);
  const runs = run(tx, [...funds, ...closing.map((group) => group.utxo)]);
  const budgets = closeBudgets();
  for (const used of runs.filter((used) => used.spend)) record("close spend", `${count} groups`, used, budgets.spend);
  record("close mint", `${count} groups`, runs.find((used) => !used.spend), budgets.mint);
}

console.log("\nThe case of each kind that comes closest to its budget:");
for (const [what, { share, detail, used, budget }] of Object.entries(worst)) {
  console.log(`  ${what.padEnd(12)} ${(share * 100).toFixed(0).padStart(3)} %  ${detail}: used ${used.mem} mem / ${used.steps} steps, budget ${budget.mem} / ${budget.steps}`);
}
if (failures.length) {
  console.error(`\n${failures.length} budget(s) too small (a budget has to be ${MARGIN} times what was measured):\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("\nAll budgets hold.");
