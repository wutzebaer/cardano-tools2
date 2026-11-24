import { getGovernance, getStakeCheck } from "@cardano/dbsync";
import { POOL_ID } from "@cardano/pool";
import { drepKind, DrepKind } from "../check/checkLogic";
import { resolveStakeAddress } from "../check/loadCheck";
import { sortActions } from "./governanceLogic";

type Overview = NonNullable<Awaited<ReturnType<typeof getGovernance>>>;
export type GovAction = Overview["actions"][number];

export interface GovernanceData {
  currentEpoch: number;
  actions: GovAction[];
  /** Whose votes the actions carry: an address with its DRep and pool, or this site's pool if no address was asked for */
  voter: {
    /** What was asked for, a `$handle` keeps its name. Null for the general page */
    label: string | null;
    stakeAddress: string | null;
    /** True when a DRep was asked for instead of an address: the page shows how that DRep voted */
    drepOnly: boolean;
    vote: DrepKind;
    drepId: string | null;
    drepName: string | null;
    poolHash: string | null;
    poolTicker: string | null;
  };
}

const ANCHOR_TIMEOUT_MS = 4000;
const ANCHOR_BYTES = 200_000;

/** Titles read from the metadata of an action, kept for as long as the server runs: an anchor never changes. */
const anchorTitles = new Map<string, { title?: string; summary?: string } | null>();

/**
 * Title and summary of an action whose metadata db-sync could not fetch, read here from the IPFS node or the web.
 * Nothing found is fine, the page describes the action by its type then.
 */
async function anchorTitle(url: string) {
  if (anchorTitles.has(url)) return anchorTitles.get(url)!;
  let found: { title?: string; summary?: string } | null = null;
  try {
    const ipfsApi = process.env.IPFS_API_URL?.replace(/\/$/, "");
    const cid = url.startsWith("ipfs://") ? url.slice("ipfs://".length) : null;
    let response: Response | null = null;
    if (cid && ipfsApi && /^[A-Za-z0-9]+$/.test(cid)) {
      response = await fetch(`${ipfsApi}/api/v0/cat?arg=${cid}&length=${ANCHOR_BYTES}`, { method: "POST", signal: AbortSignal.timeout(ANCHOR_TIMEOUT_MS), cache: "no-store" });
    } else if (url.startsWith("https://")) {
      response = await fetch(url, { signal: AbortSignal.timeout(ANCHOR_TIMEOUT_MS), cache: "no-store" });
    }
    if (response?.ok) {
      const body = (JSON.parse((await response.text()).slice(0, ANCHOR_BYTES)) as { body?: { title?: unknown; abstract?: unknown } }).body;
      const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : undefined);
      found = { title: text(body?.title), summary: text(body?.abstract) };
    }
  } catch {
    // unreachable or not the expected format: tried again after the next start of the server
  }
  anchorTitles.set(url, found);
  return found;
}

/** The actions with the votes of an address, or of this site's pool without one. */
export async function loadGovernance(input?: string): Promise<GovernanceData | { error: string }> {
  let voter: GovernanceData["voter"] = { label: null, stakeAddress: null, drepOnly: false, vote: "none", drepId: null, drepName: null, poolHash: POOL_ID, poolTicker: null };

  if (input && /^drep1[0-9a-z]{40,}$/.test(input.trim())) {
    const drepId = input.trim();
    voter = { label: drepId, stakeAddress: null, drepOnly: true, vote: "drep", drepId, drepName: null, poolHash: null, poolTicker: null };
  } else if (input) {
    const { stakeAddress, error } = await resolveStakeAddress(input);
    if (!stakeAddress) return { error: error ?? "Address not found." };
    const check = await getStakeCheck(stakeAddress);
    voter = {
      label: input.trim().startsWith("$") ? input.trim().toLowerCase() : stakeAddress,
      stakeAddress,
      drepOnly: false,
      vote: drepKind(check?.registered ? check.drepId : null),
      drepId: check?.registered ? (check.drepId ?? null) : null,
      drepName: null,
      poolHash: check?.pool?.poolHash ?? null,
      poolTicker: check?.pool?.ticker ?? null,
    };
  }

  const overview = await getGovernance(voter.vote === "drep" ? voter.drepId : null, voter.poolHash);
  if (!overview) return { error: "The governance actions could not be loaded, please try again in a moment." };
  voter.drepName = overview.drepName ?? null;

  const actions = await Promise.all(
    overview.actions.map(async (action) => {
      if (action.title || !action.anchorUrl) return action;
      const fetched = await anchorTitle(action.anchorUrl);
      return fetched ? { ...action, title: fetched.title ?? action.title, summary: fetched.summary ?? action.summary } : action;
    })
  );
  return { currentEpoch: overview.currentEpoch, actions: sortActions(actions, overview.currentEpoch), voter };
}
