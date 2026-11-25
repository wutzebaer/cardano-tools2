import { getPolicyCollection } from "@cardano/dbsync";
import { toIpfsUrl } from "@cardano/utils";
import IpfsImage from "@components/IpfsImage";
import { PageHeader } from "@components/ui";
import DropView from "../DropView";

const INTRO = "Pick a token and buy it: it is minted for you in the same transaction";

export async function generateMetadata({ params }: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await params;
  const collection = await getPolicyCollection(policyId);
  return { title: collection?.name ?? "NFT drop", description: collection?.description };
}

export default async function Page({ params }: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await params;
  // what the seller registered about the collection with the drop, nobody checked it
  const collection = await getPolicyCollection(policyId);
  return (
    <>
      <div className="flex items-start gap-5">
        {collection?.image ? (
          <IpfsImage width="192" height="192" className="size-24 shrink-0 rounded-box object-cover" src={toIpfsUrl(collection.image)} alt={collection.name} unoptimized />
        ) : null}
        <div className="min-w-0 grow">
          <PageHeader title={collection?.name ?? "NFT drop"}>
            {collection?.description ? <span className="mb-1 block whitespace-pre-line text-base-content/80">{collection.description}</span> : null}
            {INTRO}
          </PageHeader>
        </div>
      </div>
      <DropView policyId={policyId} />
    </>
  );
}
