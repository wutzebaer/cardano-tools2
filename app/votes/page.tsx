import { Notice, PageHeader } from "@components/ui";
import type { Metadata } from "next";
import CheckForm from "../check/CheckForm";
import GovernanceView from "./GovernanceView";
import { loadGovernance } from "./loadGovernance";

export const metadata: Metadata = {
  title: "Cardano governance",
  description: "What Cardano is voting on right now and what was decided lately, in plain words, and how your representative and your stake pool voted.",
};

const INTRO = "ADA holders decide how Cardano develops: proposals are put to a vote, and representatives (DReps), stake pools and a constitutional committee decide on them.";

export default async function Page() {
  const data = await loadGovernance();
  return (
    <>
      <PageHeader title="Governance" art="governance">
        What Cardano is voting on, what was decided lately, and how your representative and your pool voted
      </PageHeader>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-base-content/65">{INTRO} Enter an address to see how its representative and its pool voted.</p>
          <CheckForm base="/votes" submitLabel="Show votes" walletLabel="Show my votes" />
        </div>
        {"error" in data ? <Notice tone="warning">{data.error}</Notice> : <GovernanceView data={data} />}
      </div>
    </>
  );
}
