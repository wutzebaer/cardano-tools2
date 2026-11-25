import { toIpfsUrl } from "@cardano/utils";
import { CollectionInfo } from "@cardano/wayup";
import IpfsImage from "@components/IpfsImage";
import { Verified } from "@components/JpgStoreIcons";

/** Above the tokens of one policy: what is known about its collection. Name, text and picture come from its owner. */
export default function CollectionHeader({ policyId, collection }: { policyId: string; collection: CollectionInfo }) {
  return (
    <div className="surface mb-6 flex items-start gap-4 p-4">
      {collection.picture ? (
        <IpfsImage width="96" height="96" className="size-20 shrink-0 rounded-field bg-base-300 object-cover sm:size-24" src={toIpfsUrl(collection.picture)} alt={collection.name ?? "Collection"} />
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[11px] text-base-content/50">Collection</p>
        <h1 className="flex items-center gap-1.5 text-xl font-semibold tracking-tight">
          <span className="truncate">{collection.name}</span>
          {collection.verified ? <Verified className="size-4 shrink-0" /> : null}
        </h1>
        {collection.about ? <p className="whitespace-pre-line break-words text-sm text-base-content/65">{collection.about}</p> : null}
        <p className="break-all font-mono text-xs text-base-content/45">{policyId}</p>
      </div>
    </div>
  );
}
