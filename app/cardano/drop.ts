/** An NFT drop as the pages use it: read from the chain and changed with the connected wallet. */
import { getDropFirstOutputs, getDropOutputs, getPlutusV3CostModel, readDropList, ScriptOutputRow } from "@/app/drop/dropData";
import { answered } from "@cardano/answer";
import {
  DropConfig,
  DropList,
  DropToken,
  groupOfDatum,
  groupOfMarker,
  groupOfToken,
  isSold,
  listErrors,
  markerName,
  merkleRoot,
  merkleTree,
  parseDropList,
  positionOfToken,
  REFERENCE_LABEL,
  USER_LABEL,
  utf8Hex,
} from "@cardano/dropScript";
import { burnTokensTx, buyTokenTx, closeGroupsTx, createDropTx, Drop, dropAddress, DropGroup, dropOf, DropOutput, DropTxContext, GROUPS_PER_CLOSE, NewDrop } from "@cardano/dropTx";
import { NETWORK } from "@cardano/network";
import { royaltyMetadata } from "@cardano/royalties";
import { currentSlot, signAndSubmitTransaction, TTL_SECONDS, walletChangeAddress, walletUtxos } from "@cardano/transaction";
import { WalletConnection } from "@cardano/types";
import { uploadToIpfs } from "@/app/mint/uploadToIpfs";

export interface DropState {
  drop: Drop;
  config: DropConfig;
  /** The groups that are still open */
  groups: DropGroup[];
}

function outputsOf(rows: ScriptOutputRow[]): DropOutput[] {
  const outputs = new Map<string, DropOutput>();
  for (const row of rows) {
    const key = `${row.txHash}#${row.txIndex}`;
    const output = outputs.get(key) ?? { txHash: row.txHash, index: row.txIndex, lovelace: 0n, tokens: [] };
    if (row.maPolicyId) output.tokens.push({ policyId: row.maPolicyId, name: row.maName ?? "", quantity: BigInt(row.value) });
    else {
      output.lovelace = BigInt(row.value);
      output.datum = row.datum ?? undefined;
    }
    outputs.set(key, output);
  }
  return [...outputs.values()];
}

/** The open groups among outputs: those that hold the marker their datum names. */
function groupsOf(policyId: string, outputs: DropOutput[]): DropGroup[] {
  return outputs
    .flatMap((output) => {
      const state = output.datum ? groupOfDatum(output.datum) : undefined;
      const marked = state && output.tokens.some((token) => token.policyId === policyId && groupOfMarker(token.name) === state.group && token.quantity === 1n);
      return state && marked ? [{ ...state, output }] : [];
    })
    .sort((a, b) => a.group - b.group);
}

/** Reads a drop from the chain, null if the policy id is not a drop of this contract. */
export async function loadDrop(policyId: string): Promise<DropState | null> {
  const groups = groupsOf(policyId, outputsOf(await answered(getDropOutputs(policyId, markerName(0).slice(0, 6)))));
  // a closed drop has no groups left, what it was is still in the transaction that created it
  const config = groups[0]?.config ?? outputsOf(await answered(getDropFirstOutputs(policyId))).flatMap((output) => (output.datum ? [groupOfDatum(output.datum)] : []))[0]?.config;
  if (!config) return null;
  const drop = dropOf(config.seed, config.burnable);
  // anybody can send a made-up datum to an address, only the real contract has this policy id
  if (drop.policyId !== policyId) return null;
  return { drop, config, groups };
}

/** Loads the published list of a drop and makes sure it is the one the drop sells. */
export async function loadDropTokens(config: DropConfig): Promise<DropToken[]> {
  const tokens = parseDropList(JSON.parse(await answered(readDropList(config.list))));
  if (tokens.length !== config.total || merkleRoot(merkleTree(tokens)) !== config.root) {
    throw new Error("The published list does not match what this drop sells. Do not buy from it.");
  }
  return tokens;
}

export type TokenStatus = "available" | "sold" | "closed";

/** Whether a token can be bought: it is sold once ticked off, and nothing sells from a closed group. */
export function tokenStatus(state: DropState, index: number): TokenStatus {
  const group = state.groups.find((open) => open.group === groupOfToken(index, state.config.groups));
  if (!group) return "closed";
  return isSold(group.sold, positionOfToken(index, state.config.groups)) ? "sold" : "available";
}

async function txContext(connection: WalletConnection): Promise<DropTxContext> {
  const [utxos, changeAddress, costModel] = await Promise.all([walletUtxos(connection), walletChangeAddress(connection), answered(getPlutusV3CostModel())]);
  return { utxos, changeAddress, costModel, ttlSlot: currentSlot() + TTL_SECONDS };
}

/** Somebody else spending the same group shows as a missing input, which wallets and nodes word in many ways. */
function withCollisionHint(error: unknown): never {
  const text = error instanceof Error ? error.message : JSON.stringify(error);
  if (/already spent|BadInputs|inputs are spent|UTxO.*not found|missing.*input/i.test(text ?? "")) {
    throw new Error("Somebody else bought from this drop a moment before you, so your purchase was not accepted. Nothing was paid. Please try again.");
  }
  throw error;
}

/**
 * Publishes the list on IPFS and creates the drop. The wallet becomes its seller and owner. `royalty` asks
 * marketplaces for a share of resales, `drop.collection` is registered on chain as the name of the collection.
 */
export async function createDrop(connection: WalletConnection, drop: Omit<NewDrop, "list" | "royalty">, royalty?: { percent: number; address: string }) {
  const errors = listErrors(drop.tokens);
  if (errors.length > 0) throw new Error(errors[0]);
  const published: DropList = { version: 1, tokens: drop.tokens };
  const hash = await answered(uploadToIpfs(new File([JSON.stringify(published)], "drop.json", { type: "application/json" })));
  const { tx, drop: created } = createDropTx(await txContext(connection), NETWORK.id, { ...drop, list: `ipfs://${hash}`, royalty: royalty ? royaltyMetadata(royalty.percent, royalty.address) : undefined });
  return { txHash: await signAndSubmitTransaction(connection, tx), policyId: created.policyId };
}

/** What creating a drop takes from the wallet, in lovelace. */
export interface DropCosts {
  /** Stays with the groups at the contract until the drop is closed */
  deposit: number;
  fee: number;
}

/** A list address as long as a real one, for a transaction that is only put together to see what it costs. */
const LIST_PLACEHOLDER = `ipfs://${"Q".repeat(46)}`;

/**
 * Puts the transaction of a new drop together without publishing or signing anything and reads from it what it costs.
 * Fails like the real one, for example when the wallet holds too little.
 */
export async function dropCosts(connection: WalletConnection, drop: Omit<NewDrop, "list" | "royalty">, royalty?: { percent: number; address: string }): Promise<DropCosts> {
  // `drop.collection` goes along as it is
  const { tx, drop: created } = createDropTx(await txContext(connection), NETWORK.id, { ...drop, list: LIST_PLACEHOLDER, royalty: royalty ? royaltyMetadata(royalty.percent, royalty.address) : undefined });
  const address = dropAddress(created, NETWORK.id).to_hex();
  const outputs = tx.body().outputs();
  let deposit = 0;
  for (let index = 0; index < outputs.len(); index++) {
    const output = outputs.get(index);
    if (output.address().to_hex() === address) deposit += Number(output.amount().coin().to_str());
  }
  return { deposit, fee: Number(tx.body().fee().to_str()) };
}

/** Buys one token. The group is read again right before, so a purchase made meanwhile is seen. */
export async function buyToken(connection: WalletConnection, policyId: string, tokens: DropToken[], index: number) {
  const state = await loadDrop(policyId);
  const group = state?.groups.find((open) => open.group === groupOfToken(index, open.config.groups));
  if (!state || !group) throw new Error("This drop is closed");
  if (isSold(group.sold, positionOfToken(index, state.config.groups))) throw new Error("This token was just sold");
  const tx = buyTokenTx(await txContext(connection), NETWORK.id, state.drop, group, tokens, index);
  return signAndSubmitTransaction(connection, tx).catch(withCollisionHint);
}

/** Burns tokens of the wallet with their metadata, the deposits of the metadata return to the wallet. `royaltyToken` burns the royalty token of the drop as well. */
export async function burnTokens(connection: WalletConnection, state: DropState, assetNames: string[], royaltyToken = false) {
  const items = await Promise.all(
    assetNames.map(async (assetName) => {
      const [metadata] = outputsOf(await answered(getDropOutputs(state.drop.policyId, REFERENCE_LABEL + utf8Hex(assetName))));
      if (!metadata) throw new Error(`The metadata of ${assetName} is not at the contract, it cannot be burned here`);
      return { metadata, assetName };
    })
  );
  return signAndSubmitTransaction(connection, burnTokensTx(await txContext(connection), state.drop, items, royaltyToken));
}

/** Closes the next groups of a drop, as many as one transaction takes. Returns how many are left after it. */
export async function closeGroups(connection: WalletConnection, state: DropState) {
  const closing = state.groups.slice(0, GROUPS_PER_CLOSE);
  const txHash = await signAndSubmitTransaction(connection, closeGroupsTx(await txContext(connection), state.drop, closing)).catch(withCollisionHint);
  return { txHash, left: state.groups.length - closing.length };
}

/** Asset names of the drop's tokens the wallet holds. */
export async function heldTokens(connection: WalletConnection, policyId: string): Promise<string[]> {
  const names: string[] = [];
  for (const utxo of await walletUtxos(connection)) {
    const assets = utxo.output().amount().multiasset();
    const keys = assets?.keys();
    for (let p = 0; p < (keys?.len() ?? 0); p++) {
      if (keys!.get(p).to_hex() !== policyId) continue;
      const held = assets!.get(keys!.get(p))!;
      const heldNames = held.keys();
      for (let n = 0; n < heldNames.len(); n++) {
        const name = Buffer.from(heldNames.get(n).name()).toString("hex");
        if (name.startsWith(USER_LABEL)) names.push(Buffer.from(name.slice(USER_LABEL.length), "hex").toString("utf8"));
      }
    }
  }
  return names;
}
