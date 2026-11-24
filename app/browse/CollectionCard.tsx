import { slotToUnix } from "@cardano/network";
import LocalTime from "@components/LocalTime";
import { TokenListItem } from "@cardano/types";
import { assetNameFromHex, shortenId, toIpfsUrl } from "@cardano/utils";
import { CollectionInfo } from "@cardano/wayup";
import IpfsImage from "@components/IpfsImage";
import { Verified } from "@components/JpgStoreIcons";
import TokenImagePlaceholder from "@components/TokenImagePlaceholder";
import Link from "next/link";

const PREVIEWS = 4;

/** Several tokens of one policy as a single card of the feed, linking to all tokens of the policy. */
export default function CollectionCard({ policyId, tokens, collection }: { policyId: string; tokens: TokenListItem[]; collection?: CollectionInfo }) {
  const href = `/browse/search/${policyId}`;
  const name = collection?.name;
  const previews = tokens.slice(0, PREVIEWS);
  const newest = tokens[0];

  return (
    <article className="surface group flex flex-col overflow-hidden transition-colors hover:border-line-strong hover:bg-base-300">
      <Link href={href} className="relative grid aspect-square grid-cols-2 gap-px overflow-hidden bg-base-100" aria-label={`${tokens.length} tokens of ${name ?? policyId}`}>
        {previews.map((token) => {
          const imageSrc = toIpfsUrl(token.image);
          return imageSrc ? (
            <IpfsImage key={token.maFingerprint} width="256" height="256" className="aspect-square w-full bg-base-300 object-cover object-top" src={imageSrc} alt={token.name || assetNameFromHex(token.maName)} />
          ) : (
            <TokenImagePlaceholder key={token.maFingerprint} />
          );
        })}
        {previews.length < PREVIEWS ? <div className="aspect-square bg-base-300" /> : null}
        <span className="absolute right-2 top-2 rounded-full bg-base-100/85 px-2.5 py-1 text-xs font-semibold tabular-nums backdrop-blur">{tokens.length} tokens</span>
      </Link>
      <div className="flex flex-col gap-1 p-4">
        <p className="flex items-center gap-1 text-[11px] text-base-content/50">
          Collection
          {collection?.verified ? <Verified className="size-3.5 shrink-0" /> : null}
        </p>
        <h3 className={`truncate text-[15px] font-semibold tracking-tight ${name ? "" : "font-mono"}`} title={name ?? policyId}>
          <Link href={href} className="hover:text-primary">
            {name ?? shortenId(policyId, 8)}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-base-content/45">{newest?.slotNo != null ? <LocalTime unix={slotToUnix(newest.slotNo)} time /> : null}</p>
      </div>
    </article>
  );
}
