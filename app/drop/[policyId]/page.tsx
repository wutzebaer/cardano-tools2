import { PageHeader } from "@components/ui";
import DropView from "../DropView";

export const metadata = { title: "NFT drop" };

export default async function Page({ params }: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await params;
  return (
    <>
      <PageHeader title="NFT drop">Pick a token and buy it: it is minted for you in the same transaction</PageHeader>
      <DropView policyId={policyId} />
    </>
  );
}
