// Runs the drop contract against the preview testnet with a throwaway key.
//
//   node run.mjs create [burnable]      create a drop of five tokens in two groups, optionally one whose tokens can be burned
//   node run.mjs buy <number>           buy one token
//   node run.mjs buy-both <a> <b>       buy two tokens of different groups without waiting in between
//   node run.mjs burn <number>          burn a token of the wallet and take the deposit of its metadata back
//   node run.mjs cheat <kind> <number>  try something that must be refused: twice, underpay, metadata, steal, burn
//   node run.mjs close                  close all groups
//   node run.mjs show                   print what is on the chain
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { blake2b } from "@noble/hashes/blake2b";
import {
  Lucid,
  Koios,
  CML,
  Constr,
  Data,
  applyDoubleCborEncoding,
  applyParamsToScript,
  fromText,
  getAddressDetails,
  mintingPolicyToId,
  validatorToAddress,
} from "@lucid-evolution/lucid";

const NETWORK = "Preview";
const STATE = new URL("./state.json", import.meta.url);
const TOTAL = 5;
const GROUPS = 2;
const PRICE = 5_000_000n;
const DEPOSIT = 2_000_000n;
const REFERENCE_LABEL = "000643b0";
const USER_LABEL = "000de140";

// The node of the provider runs the scripts, so a refusal comes from the real ledger rules.
const EVALUATE = { localUPLCEval: false };
const hex = (bytes) => Buffer.from(bytes).toString("hex");
const blake2b256 = (hexBytes) => hex(blake2b(Buffer.from(hexBytes, "hex"), { dkLen: 32 }));

// ---- the list of tokens and its Merkle tree, the same rules as lib/drop/merkle.ak

const nameOf = (number) => fromText(`Preview Drop #${number + 1}`);
/**
 * Plutus data as the chain itself writes it (lists open-ended, maps with a length, entries in the given order).
 * The contract hashes the metadata in this form, so the tree has to use it too. `Data.to` writes maps differently.
 */
function plutusCbor(data) {
  const head = (major, n) => {
    if (n < 24) return hex([(major << 5) | n]);
    if (n < 256) return hex([(major << 5) | 24, n]);
    if (n < 65536) return hex([(major << 5) | 25, n >> 8, n & 255]);
    throw new Error("too large for this test");
  };
  const list = (items) => (items.length ? "9f" + items.map(plutusCbor).join("") + "ff" : "80");
  if (typeof data === "bigint") return head(0, Number(data));
  if (typeof data === "string") {
    if (data.length > 128) throw new Error("byte strings over 64 bytes are split on chain, not needed here");
    return head(2, data.length / 2) + data;
  }
  if (Array.isArray(data)) return list(data);
  if (data instanceof Map) return head(5, data.size) + [...data].map(([key, value]) => plutusCbor(key) + plutusCbor(value)).join("");
  if (data instanceof Constr && data.index < 7) return "d8" + hex([0x79 + data.index]) + list(data.fields);
  throw new Error("unsupported data");
}
/** CIP-68 metadata datum of a token. */
const metadataOf = (number) =>
  plutusCbor(
    new Constr(0, [
      new Map([
        [fromText("name"), nameOf(number)],
        [fromText("image"), fromText(`ipfs://example/${number + 1}.png`)],
      ]),
      1n,
    ]),
  );
const leaf = (name, metadataHash) => blake2b256("00" + metadataHash + name);
const node = (left, right) => blake2b256("01" + left + right);

function leaves() {
  const tokens = Array.from({ length: TOTAL }, (_, number) => leaf(nameOf(number), blake2b256(metadataOf(number))));
  let size = 1;
  while (size < tokens.length) size *= 2;
  return tokens.concat(Array(size - tokens.length).fill("00".repeat(32)));
}
function rootOf(hashes) {
  while (hashes.length > 1) hashes = hashes.flatMap((hash, i) => (i % 2 ? [] : [node(hash, hashes[i + 1])]));
  return hashes[0];
}
function proofOf(hashes, index) {
  const proof = [];
  while (hashes.length > 1) {
    proof.push(hashes[index ^ 1]);
    hashes = hashes.flatMap((hash, i) => (i % 2 ? [] : [node(hash, hashes[i + 1])]));
    index >>= 1;
  }
  return proof;
}

// ---- the data the contract reads

const marker = (group) => fromText("grp") + group.toString(16).padStart(4, "0");
const sizeOfGroup = (group) => Math.floor((TOTAL - group + GROUPS - 1) / GROUPS);
function tick(sold, position) {
  const bytes = Buffer.from(sold, "hex");
  bytes[position >> 3] |= 0x80 >> (position & 7);
  return hex(bytes);
}
const isTicked = (sold, position) => (Buffer.from(sold, "hex")[position >> 3] & (0x80 >> (position & 7))) !== 0;
const addressData = (keyHash) => new Constr(0, [new Constr(0, [keyHash]), new Constr(1, [])]);
const configData = (keyHash) => new Constr(0, [rootOf(leaves()), BigInt(TOTAL), BigInt(GROUPS), PRICE, addressData(keyHash), keyHash]);
const groupData = (config, group, sold) => Data.to(new Constr(0, [config, BigInt(group), sold]));

// ---- setup

const key = JSON.parse(readFileSync("/keys/preview-key.json", "utf8"));
const lucid = await Lucid(new Koios("https://preview.koios.rest/api/v1"), NETWORK);
lucid.selectWallet.fromPrivateKey(CML.PrivateKey.from_normal_bytes(Buffer.from(key.privateKey, "hex")).to_bech32());
const wallet = await lucid.wallet().address();
const keyHash = getAddressDetails(wallet).paymentCredential.hash;

function contract({ seed, burnable }) {
  const blueprint = JSON.parse(readFileSync(new URL("../plutus.json", import.meta.url), "utf8"));
  const code = blueprint.validators.find((validator) => validator.title === "drop.drop.spend").compiledCode;
  const script = {
    type: "PlutusV3",
    script: applyParamsToScript(applyDoubleCborEncoding(code), [new Constr(0, [seed.txHash, BigInt(seed.outputIndex)]), new Constr(burnable ? 1 : 0, [])]),
  };
  return { script, policy: mintingPolicyToId(script), address: validatorToAddress(NETWORK, script) };
}
function drop() {
  if (!existsSync(STATE)) throw new Error("no drop yet, run create first");
  return contract(JSON.parse(readFileSync(STATE, "utf8")));
}
async function groupsOf({ address, policy }) {
  const found = [];
  for (const utxo of await lucid.utxosAt(address)) {
    for (let group = 0; group < GROUPS; group++) {
      if (utxo.assets[policy + marker(group)] !== 1n) continue;
      const [config, , sold] = Data.from(utxo.datum).fields;
      found.push({ group, utxo, config, sold });
    }
  }
  return found.sort((a, b) => a.group - b.group);
}
/** Waits until the wallet holds an output of the transaction. Every transaction here leaves change. */
async function confirmed(hash) {
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    if ((await lucid.utxosAt(wallet)).some((utxo) => utxo.txHash === hash)) return;
  }
}
async function send(builder, what) {
  const tx = await builder.complete(EVALUATE);
  const hash = await (await tx.sign.withWallet().complete()).submit();
  console.log(`${what}: submitted ${hash}, fee ${Number(tx.toTransaction().body().fee()) / 1e6} ADA`);
  await confirmed(hash);
  console.log(`${what}: confirmed`);
  return hash;
}

// ---- the transactions

async function create(burnable) {
  const [found] = await lucid.wallet().getUtxos();
  const state = { seed: { txHash: found.txHash, outputIndex: found.outputIndex }, burnable };
  const seed = found;
  const { script, policy, address } = contract(state);
  const config = configData(keyHash);
  let builder = lucid
    .newTx()
    .collectFrom([seed])
    .mintAssets(Object.fromEntries(Array.from({ length: GROUPS }, (_, group) => [policy + marker(group), 1n])), Data.to(new Constr(0, [config])))
    .attach.MintingPolicy(script);
  for (let group = 0; group < GROUPS; group++) {
    const sold = "00".repeat(Math.ceil(sizeOfGroup(group) / 8));
    builder = builder.pay.ToContract(address, { kind: "inline", value: groupData(config, group, sold) }, { lovelace: DEPOSIT, [policy + marker(group)]: 1n });
  }
  writeFileSync(STATE, JSON.stringify(state));
  console.log(`policy ${policy}\naddress ${address}\nburnable ${burnable}`);
  await send(builder, "create");
}

/** A purchase as an honest buyer builds it. `cheat` bends one part of it. */
async function purchase(number, cheat, walletUtxos) {
  const { script, policy, address } = drop();
  const group = (await groupsOf({ address, policy })).find((found) => found.group === number % GROUPS);
  if (!group) throw new Error(`group ${number % GROUPS} is closed`);
  const position = Math.floor(number / GROUPS);
  if (isTicked(group.sold, position) && cheat !== "twice") throw new Error(`token ${number} is sold`);
  const name = nameOf(number);
  const next = { ...group.utxo.assets };
  if (cheat === "steal") next.lovelace -= 1_000_000n;
  if (walletUtxos) lucid.overrideUTxOs(walletUtxos);
  return lucid
    .newTx()
    .collectFrom([group.utxo], Data.to(new Constr(0, [BigInt(number), name, proofOf(leaves(), number)])))
    .mintAssets({ [policy + REFERENCE_LABEL + name]: 1n, [policy + USER_LABEL + name]: 1n }, Data.to(new Constr(1, [])))
    .attach.Script(script)
    .pay.ToContract(address, { kind: "inline", value: groupData(group.config, group.group, tick(group.sold, position)) }, next)
    .pay.ToContract(address, { kind: "inline", value: metadataOf(cheat === "metadata" ? (number + GROUPS) % TOTAL : number) }, { [policy + REFERENCE_LABEL + name]: 1n })
    .pay.ToAddress(wallet, { lovelace: cheat === "underpay" ? PRICE - 1n : PRICE });
}

/** Burns a token of the wallet together with its metadata token, which frees the deposit of the metadata. */
async function burning(number) {
  const { script, policy, address } = drop();
  const name = nameOf(number);
  const metadata = (await lucid.utxosAt(address)).find((utxo) => utxo.assets[policy + REFERENCE_LABEL + name] === 1n);
  if (!metadata) throw new Error(`no metadata of token ${number} at the script`);
  return lucid
    .newTx()
    .collectFrom([metadata], Data.to(new Constr(2, [])))
    .mintAssets({ [policy + REFERENCE_LABEL + name]: -1n, [policy + USER_LABEL + name]: -1n }, Data.to(new Constr(2, [])))
    .attach.Script(script);
}

async function close() {
  const { script, policy, address } = drop();
  const groups = await groupsOf({ address, policy });
  if (!groups.length) throw new Error("nothing to close");
  const builder = lucid
    .newTx()
    .collectFrom(groups.map((group) => group.utxo), Data.to(new Constr(1, [])))
    .mintAssets(Object.fromEntries(groups.map((group) => [policy + marker(group.group), -1n])), Data.to(new Constr(1, [])))
    .attach.Script(script)
    .addSignerKey(keyHash);
  await send(builder, "close");
}

async function show() {
  const { policy, address } = drop();
  console.log(`policy ${policy}\naddress ${address}`);
  for (const utxo of await lucid.utxosAt(address)) {
    const tokens = Object.entries(utxo.assets).filter(([unit]) => unit !== "lovelace").map(([unit, amount]) => `${amount} ${Buffer.from(unit.slice(56), "hex").toString("latin1").replace(/[^\x20-\x7e]/g, ".")}`);
    const fields = Data.from(utxo.datum).fields;
    const what = fields.length === 3 ? `group ${fields[1]}, sold bits ${fields[2]}` : "metadata";
    console.log(`  ${utxo.txHash.slice(0, 8)}#${utxo.outputIndex} ${Number(utxo.assets.lovelace) / 1e6} ADA [${tokens}] ${what}`);
  }
  const mine = await lucid.wallet().getUtxos();
  const own = mine.flatMap((utxo) => Object.keys(utxo.assets)).filter((unit) => unit.startsWith(policy));
  console.log(`wallet: ${Number(mine.reduce((sum, utxo) => sum + utxo.assets.lovelace, 0n)) / 1e6} ADA, tokens of the drop: ${own.map((unit) => Buffer.from(unit.slice(64), "hex").toString()).join(", ") || "none"}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "create") await create(args[0] === "burnable");
else if (command === "burn") await send(await burning(Number(args[0])), `burn ${args[0]}`);
else if (command === "buy") await send(await purchase(Number(args[0])), `buy ${args[0]}`);
else if (command === "buy-both") {
  // The second purchase does not wait for the first: it only needs wallet outputs the first one left.
  const [left, , first] = await (await purchase(Number(args[0]))).chain(EVALUATE);
  const second = await (await purchase(Number(args[1]), undefined, left)).complete(EVALUATE);
  const hashes = [];
  for (const tx of [first, second]) hashes.push(await (await tx.sign.withWallet().complete()).submit());
  console.log(`submitted ${hashes.join(" and ")}`);
  for (const hash of hashes) await confirmed(hash);
  console.log("both confirmed");
} else if (command === "cheat") {
  try {
    await (args[0] === "burn" ? await burning(Number(args[1])) : await purchase(Number(args[1]), args[0])).complete(EVALUATE);
    console.log(`cheat ${args[0]}: ACCEPTED, this must not happen`);
    process.exitCode = 1;
  } catch (error) {
    console.log(`cheat ${args[0]}: refused (${String(error?.message ?? error).replace(/\s+/g, " ").slice(0, 160)})`);
  }
} else if (command === "close") await close();
else if (command === "show") await show();
else console.log("commands: create [burnable], buy <number>, buy-both <a> <b>, burn <number>, cheat <twice|underpay|metadata|steal|burn> <number>, close, show");
process.exit();
