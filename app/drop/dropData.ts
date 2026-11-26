"use server";

import { Answer, answer, UserError } from "@cardano/answer";

/** One asset of an output at a script: a row for the ADA, which carries the datum, and a row per token. */
export interface ScriptOutputRow {
  txHash: string;
  txIndex: number;
  maPolicyId?: string | null;
  maName?: string | null;
  value: number;
  datum?: string | null;
  spent: boolean;
}

const MAX_LIST_BYTES = 8_000_000;

async function chain<T>(path: string): Promise<T> {
  const response = await fetch(`${process.env.CARDANO_DBSYNC_API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} answered ${response.status}`);
  return response.json();
}

function policyOf(policyId: string) {
  if (!/^[0-9a-f]{56}$/.test(policyId)) throw new UserError("This is not a policy id");
  return policyId;
}

/** Unspent outputs of a drop that hold one of its tokens whose name starts with the prefix (hex). */
export async function getDropOutputs(policyId: string, namePrefix: string): Promise<Answer<ScriptOutputRow[]>> {
  return answer(() => {
    if (!/^([0-9a-f]{2}){1,32}$/.test(namePrefix)) throw new UserError("This is not a token name");
    return chain<ScriptOutputRow[]>(`/script/${policyOf(policyId)}/outputs?namePrefix=${namePrefix}`);
  });
}

/**
 * Names (hex) of all tokens ever minted under a drop that start with the prefix, burned ones included. What was sold
 * is told from them once the groups that kept track of it are closed.
 */
export async function getDropMintedNames(policyId: string, namePrefix: string): Promise<Answer<string[]>> {
  return answer(() => {
    if (!/^([0-9a-f]{2}){1,32}$/.test(namePrefix)) throw new UserError("This is not a token name");
    return chain<string[]>(`/script/${policyOf(policyId)}/mintedNames?namePrefix=${namePrefix}`);
  });
}

/** What the transaction that created a drop put at its address, for a drop whose groups are closed. */
export async function getDropFirstOutputs(policyId: string): Promise<Answer<ScriptOutputRow[]>> {
  return answer(() => chain<ScriptOutputRow[]>(`/script/${policyOf(policyId)}/firstOutputs`));
}

export async function getPlutusV3CostModel(): Promise<Answer<number[]>> {
  return answer(() => chain<number[]>("/costModel/plutusV3"));
}

/** Reads the published list of a drop from IPFS. Its content is checked in the browser against the root on chain. */
export async function readDropList(pointer: string): Promise<Answer<string>> {
  return answer(async () => {
    const cid = pointer.match(/^ipfs:\/\/([A-Za-z0-9]{46,64})$/)?.[1];
    if (!cid) throw new UserError("The list of this drop is not published on IPFS, this site cannot read it");
    const apiUrl = process.env.IPFS_API_URL?.replace(/\/$/, "");
    if (!apiUrl) throw new Error("IPFS_API_URL is not set");
    const response = await fetch(`${apiUrl}/api/v0/cat?arg=${cid}&length=${MAX_LIST_BYTES + 1}`, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!response?.ok) throw new UserError("The list of this drop could not be loaded from IPFS. Please try again in a moment.");
    const text = await response.text();
    if (text.length > MAX_LIST_BYTES) throw new UserError("The list of this drop is too large to load");
    return text;
  });
}
