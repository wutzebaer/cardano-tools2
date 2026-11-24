"use server";

import { actionTitle, typeLabel } from "../votes/governanceLogic";
import { loadGovernance } from "../votes/loadGovernance";

export interface DrepVote {
  /** What was asked: the title of the proposal, or a description of it if it has none */
  title: string;
  /** Kind of proposal in plain words, e.g. "Treasury withdrawal" */
  kind: string;
  /** "Yes", "No" or "Abstain" */
  vote: string;
}

/**
 * The newest proposal a DRep voted on and what it voted, null if it voted on none of the recent ones.
 * The chain data carries no time per vote here, so "latest" goes by when the proposal was submitted.
 */
export async function latestDrepVote(drepId: string): Promise<DrepVote | null> {
  if (!/^drep1[0-9a-z]{40,}$/.test(drepId)) return null;
  const data = await loadGovernance(drepId);
  if ("error" in data) return null;
  const voted = data.actions.filter((action) => action.drepVote).sort((a, b) => b.submittedEpoch - a.submittedEpoch);
  const latest = voted[0];
  return latest?.drepVote ? { title: actionTitle(latest), kind: typeLabel(latest.type), vote: latest.drepVote } : null;
}
