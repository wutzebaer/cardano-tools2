import { getPoolList } from "@cardano/dbsync";
import { PageHeader } from "@components/ui";
import RewardsForm from "./RewardsForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  // the ticker lookup is a convenience, the form also takes a pool id
  const pools = await getPoolList().catch(() => []);
  return (
    <>
      <PageHeader title="Reward stakers">Distribute ADA and tokens from your wallet to the delegators of a pool, proportional to their stake</PageHeader>
      <RewardsForm pools={pools} />
    </>
  );
}
