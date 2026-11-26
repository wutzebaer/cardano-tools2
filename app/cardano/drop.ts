/** An NFT drop as the pages use it: read from the chain and changed with the connected wallet. */
import { getDropFirstOutputs, getDropMintedNames, getDropOutputs, getPlutusV3CostModel, readDropList, ScriptOutputRow } from "@/app/drop/dropData";
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
import { protocol } from "@cardano/protocol";
import { refreshProtocol } from "@cardano/protocolLoad";
import { royaltyMetadata } from "@cardano/royalties";
import { currentSlot, signAndSubmitTransaction, TTL_SECONDS, walletChangeAddress, walletUtxos } from "@cardano/transaction";
import { WalletConnection } from "@cardano/types";
import { uploadToIpfs } from "@/app/mint/uploadToIpfs";

export interface DropState {
  drop: Drop;
  config: DropConfig;
  /** The groups that are still open */
  groups: DropGroup[];
  /**
   * Asset names (hex) of the tokens that were ever minted, read only where a group is closed: a closed group no longer
   * says what it sold, but a sold token was minted, and that stays on chain even if it was burned since.
   */
  minted?: Set<string>;
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

/** Whether an output holds exactly one of a token. */
const holdsToken = (output: DropOutput, policyId: string, name: string) => output.tokens.some((token) => token.policyId === policyId && token.name === name && token.quantity === 1n);

/** Reads a drop from the chain, null if the policy id is not a drop of this contract. */
export async function loadDrop(policyId: string): Promise<DropState | null> {
  const groups = groupsOf(policyId, outputsOf(await answered(getDropOutputs(policyId, markerName(0).slice(0, 6)))));
  // a closed drop has no groups left, what it was is still in the transaction that created it
  const config = groups[0]?.config ?? outputsOf(await answered(getDropFirstOutputs(policyId))).flatMap((output) => (output.datum ? [groupOfDatum(output.datum)] : []))[0]?.config;
  if (!config) return null;
  const drop = dropOf(config.seed, config.burnable);
  // anybody can send a made-up datum to an address, only the real contract has this policy id
  if (drop.policyId !== policyId) return null;
  if (groups.length >= config.groups) return { drop, config, groups };
  // without the answer the tokens of closed groups show as closed, as before
  const minted = await answered(getDropMintedNames(policyId, USER_LABEL)).catch(() => undefined);
  return { drop, config, groups, minted: minted ? new Set(minted) : undefined };
}

/** The list of a drop as it is published: these bytes decide its address on IPFS, so they are the ones to keep. */
export const dropListJson = (tokens: DropToken[]) => JSON.stringify({ version: 1, tokens } satisfies DropList);

/** Reads a list and makes sure it is the one the drop sells, wherever it comes from. */
function verifiedTokens(config: DropConfig, json: string): DropToken[] {
  const tokens = parseDropList(JSON.parse(json));
  if (tokens.length !== config.total || merkleRoot(merkleTree(tokens)) !== config.root) {
    throw new Error("This list does not match what the drop sells. Do not buy from it.");
  }
  return tokens;
}

/** Loads the published list of a drop and makes sure it is the one the drop sells. */
export async function loadDropTokens(config: DropConfig): Promise<DropToken[]> {
  return verifiedTokens(config, await answered(readDropList(config.list)));
}

/**
 * Takes the list of a drop from a file, for a drop whose list can no longer be loaded from IPFS. The file is only
 * used if it is the list the drop sells. It is published again as well: the same bytes get the same address, so the
 * drop then works for everybody again. `republished` says whether that worked out.
 */
export async function dropTokensFromFile(config: DropConfig, file: File): Promise<{ tokens: DropToken[]; republished: boolean }> {
  let tokens: DropToken[];
  try {
    tokens = verifiedTokens(config, await file.text());
  } catch (error) {
    throw new Error(error instanceof SyntaxError ? "This file is not a list of tokens." : error instanceof Error ? error.message : "This file cannot be read.");
  }
  const hash = await answered(uploadToIpfs(file)).catch(() => null);
  return { tokens, republished: `ipfs://${hash}` === config.list };
}

export type TokenStatus = "available" | "sold" | "closed";

/**
 * Whether a token can be bought: it is sold once ticked off, and nothing sells from a closed group. A token of a
 * closed group is sold if it was ever minted, and closed if nobody bought it.
 */
export function tokenStatus(state: DropState, index: number, assetName: string): TokenStatus {
  const group = state.groups.find((open) => open.group === groupOfToken(index, state.config.groups));
  if (!group) return state.minted?.has(USER_LABEL + utf8Hex(assetName)) ? "sold" : "closed";
  return isSold(group.sold, positionOfToken(index, state.config.groups)) ? "sold" : "available";
}

async function txContext(connection: WalletConnection): Promise<DropTxContext> {
  const [utxos, changeAddress, costModel] = await Promise.all([walletUtxos(connection), walletChangeAddress(connection), answered(getPlutusV3CostModel()), refreshProtocol()]);
  return { utxos, changeAddress, costModel, params: protocol(), ttlSlot: currentSlot() + TTL_SECONDS };
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
  const list = dropListJson(drop.tokens);
  const hash = await answered(uploadToIpfs(new File([list], "drop.json", { type: "application/json" })));
  const { tx, drop: created } = createDropTx(await txContext(connection), NETWORK.id, { ...drop, list: `ipfs://${hash}`, royalty: royalty ? royaltyMetadata(royalty.percent, royalty.address) : undefined });
  return { txHash: await signAndSubmitTransaction(connection, tx), policyId: created.policyId, list };
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
      // the API looks for names that start like this one, "Robot1" finds "Robot10" as well
      const reference = REFERENCE_LABEL + utf8Hex(assetName);
      const metadata = outputsOf(await answered(getDropOutputs(state.drop.policyId, reference))).find((output) => holdsToken(output, state.drop.policyId, reference));
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
