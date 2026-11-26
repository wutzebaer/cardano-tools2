import { shortenId } from "@cardano/utils";
import { Notice, PageHeader } from "@components/ui";
import type { Metadata } from "next";
import CheckForm from "../../check/CheckForm";
import GovernanceView from "../GovernanceView";
import { loadGovernance } from "../loadGovernance";

type Props = { params: Promise<{ address: string }> };

const inputOf = async (params: Props["params"]) => decodeURIComponent((await params).address);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const input = await inputOf(params);
  const name = input.startsWith("$") ? input.toLowerCase() : shortenId(input, 8);
  return {
    title: `Governance votes for ${name}`,
    description: "How the representative and the stake pool of this Cardano address voted on the current governance proposals.",
    // pages of single addresses are for sharing, not for search engines
    robots: { index: false },
  };
}

export default async function Page({ params }: Props) {
  const input = await inputOf(params);
  const data = await loadGovernance(input);
  return (
    <>
      <PageHeader title="Governance" art="governance" compact>
        What Cardano is voting on and how the representative and the pool of an address voted
      </PageHeader>
      <div className="flex flex-col gap-4 sm:gap-8">
        <CheckForm initial={input} base="/votes" submitLabel="Show votes" />
        {"error" in data ? <Notice tone="warning">{data.error}</Notice> : <GovernanceView data={data} />}
      </div>
    </>
  );
}
