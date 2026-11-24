/**
 * What a governance action is, where it stands and what a vote on it means, in words for people who do not follow
 * Cardano governance. Pure: the page and the tests feed it the answers of the chain data API.
 */

export interface ActionFacts {
  type: string;
  title?: string | null;
  submittedEpoch: number;
  expiresEpoch: number;
  ratifiedEpoch?: number | null;
  enactedEpoch?: number | null;
  droppedEpoch?: number | null;
  expiredEpoch?: number | null;
  /** Lovelace of a treasury withdrawal */
  withdrawal?: number | null;
}

export type ActionState = "open" | "ratified" | "enacted" | "expired" | "dropped";

export interface ActionStatus {
  state: ActionState;
  label: string;
  /** What that means for the proposal */
  text: string;
}

export const EPOCH_DAYS = 5;

const TYPES: Record<string, { label: string; text: string; poolsVote: boolean }> = {
  TreasuryWithdrawals: { label: "Treasury withdrawal", text: "Asks for ADA from Cardano's shared treasury.", poolsVote: false },
  InfoAction: { label: "Poll", text: "Asks for an opinion. The result changes nothing on chain by itself.", poolsVote: true },
  ParameterChange: { label: "Parameter change", text: "Changes a setting of the network, such as fees or limits.", poolsVote: true },
  NewConstitution: { label: "New constitution", text: "Replaces or amends the constitution Cardano is governed by.", poolsVote: false },
  NewCommittee: { label: "Committee change", text: "Changes who sits on the committee that guards the constitution, or its rules.", poolsVote: true },
  NoConfidence: { label: "No confidence", text: "Declares no confidence in the current constitutional committee.", poolsVote: true },
  HardForkInitiation: { label: "Hard fork", text: "Upgrades the network to a new protocol version.", poolsVote: true },
};

export const typeLabel = (type: string) => TYPES[type]?.label ?? type;

export const typeText = (type: string) => TYPES[type]?.text ?? "";

/**
 * Whether stake pools vote on actions of this type. On parameter changes they only vote for the security-relevant
 * parameters, which the type alone does not tell.
 */
export const poolsVoteOn = (type: string) => TYPES[type]?.poolsVote ?? true;

/** The title from the action's metadata, or a description of what it is if that could not be read. */
export function actionTitle(action: Pick<ActionFacts, "type" | "title" | "withdrawal">) {
  const title = action.title?.trim();
  if (title) return title;
  if (action.type === "TreasuryWithdrawals" && action.withdrawal) {
    return `Treasury withdrawal of ${Math.round(action.withdrawal / 1_000_000).toLocaleString("en-US")} ₳`;
  }
  return `${typeLabel(action.type)} without a readable title`;
}

/** Where an action stands. An enacted action was ratified before, an expired one is dropped later: the outcome counts. */
export function actionStatus(action: ActionFacts, currentEpoch: number): ActionStatus {
  if (action.enactedEpoch != null) {
    return { state: "enacted", label: "Enacted", text: `Approved and in effect since epoch ${action.enactedEpoch}.` };
  }
  if (action.ratifiedEpoch != null) {
    return { state: "ratified", label: "Approved", text: "Approved, it takes effect at the next epoch boundary." };
  }
  if (action.expiredEpoch != null) {
    return { state: "expired", label: "Not approved", text: `Voting ended in epoch ${action.expiresEpoch} without the approval it needed.` };
  }
  if (action.droppedEpoch != null) {
    return { state: "dropped", label: "Dropped", text: "Removed because another action it depended on or competed with was decided." };
  }
  const epochs = action.expiresEpoch - currentEpoch;
  if (epochs < 0) {
    return { state: "expired", label: "Voting ended", text: "Voting has ended, the result is counted at the epoch boundary." };
  }
  return {
    state: "open",
    label: "Open for voting",
    text: epochs === 0 ? "Voting ends with this epoch." : `Voting ends in ${epochs} epoch${epochs === 1 ? "" : "s"}, about ${epochs * EPOCH_DAYS} days.`,
  };
}

export type VoterKind = "none" | "abstain" | "no_confidence" | "drep";

/** How the vote of an address reads on one action, given who votes for it. */
export function voteOfAddress(kind: VoterKind, drepVote: string | null | undefined, state: ActionState): string {
  if (kind === "none") return "no choice made, the ADA is not counted";
  if (kind === "abstain") return "does not take part";
  if (kind === "no_confidence") return "counts as no confidence";
  if (drepVote) return drepVote === "Abstain" ? "abstained" : `voted ${drepVote.toLowerCase()}`;
  return state === "open" ? "has not voted yet" : "did not vote";
}

/** How a pool's vote reads on one action. */
export function voteOfPool(type: string, poolVote: string | null | undefined, state: ActionState): string {
  if (poolVote) return poolVote === "Abstain" ? "abstained" : `voted ${poolVote.toLowerCase()}`;
  if (!poolsVoteOn(type)) return "pools do not vote on this";
  return state === "open" ? "has not voted yet" : "did not vote";
}

/** Open actions first, the one that ends soonest on top, then the closed ones, newest first. */
export function sortActions<T extends ActionFacts>(actions: T[], currentEpoch: number): T[] {
  const open = (action: T) => actionStatus(action, currentEpoch).state === "open";
  return [...actions].sort((a, b) => {
    if (open(a) !== open(b)) return open(a) ? -1 : 1;
    return open(a) ? a.expiresEpoch - b.expiresEpoch || b.submittedEpoch - a.submittedEpoch : b.expiresEpoch - a.expiresEpoch;
  });
}
