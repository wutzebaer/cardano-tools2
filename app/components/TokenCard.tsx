import { TokenListItem } from '@cardano/types';
import { assetNameFromHex, shortenId, slotToDate, toIpfsUrl } from '@cardano/utils';
import { CollectionInfo } from '@cardano/wayup';
import IpfsImage from '@components/IpfsImage';
import TokenImagePlaceholder from '@components/TokenImagePlaceholder';
import { Verified } from '@components/JpgStoreIcons';
import Link from 'next/link';

function TokenCard({ item, collection }: { item: TokenListItem; collection?: CollectionInfo }) {
    const href = `/browse/token/${item.maFingerprint}`;
    const name = item.name || assetNameFromHex(item.maName);
    const imageSrc = toIpfsUrl(item.image);
    const collectionName = collection?.name;

    return (
        <article className="surface group flex flex-col overflow-hidden transition-colors hover:border-line-strong hover:bg-base-300">
            <Link href={href} scroll={false} className="relative block aspect-square overflow-hidden bg-base-300">
                {imageSrc ? (
                    <IpfsImage
                        width="512"
                        height="512"
                        className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        src={imageSrc}
                        alt={name}
                    />
                ) : (
                    <TokenImagePlaceholder />
                )}
            </Link>
            <div className="flex flex-col gap-1 p-4">
                <Link
                    href={`/browse/search/${item.maPolicyId}`}
                    className={`flex items-center gap-1 text-[11px] hover:text-base-content ${collectionName ? "text-base-content/50" : "font-mono text-base-content/50"}`}
                    title={collectionName ?? item.maPolicyId}
                >
                    <span className="truncate">{collectionName ?? shortenId(item.maPolicyId)}</span>
                    {collection?.verified ? <Verified className="size-3.5 shrink-0" /> : null}
                </Link>
                <h3 className="truncate text-[15px] font-semibold tracking-tight">
                    <Link href={href} scroll={false} className="hover:text-primary">
                        {name}
                    </Link>
                </h3>
                <p className="mt-1 text-xs text-base-content/45">
                    {item.slotNo != null ? slotToDate(item.slotNo) : null}
                </p>
            </div>
        </article>
    );
}

export default TokenCard;
