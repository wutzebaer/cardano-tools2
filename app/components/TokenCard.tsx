import { TokenListItem } from '@cardano/types';
import { slotToUnix } from '@cardano/network';
import LocalTime from '@components/LocalTime';
import { technicalToken } from '@cardano/technicalToken';
import { assetNameFromHex, shortenId, toIpfsUrl } from '@cardano/utils';
import { CollectionInfo } from '@cardano/wayup';
import IpfsImage from '@components/IpfsImage';
import TokenImagePlaceholder from '@components/TokenImagePlaceholder';
import { Verified } from '@components/JpgStoreIcons';
import Link from 'next/link';
import { ReactNode } from 'react';

function TokenCard({ item, collection, footer, badge }: { item: TokenListItem; collection?: CollectionInfo; footer?: ReactNode; badge?: string }) {
    const href = `/browse/token/${item.maFingerprint}`;
    // the royalty token, the group of a drop, a reference NFT: shown as what they are
    const technical = technicalToken(item.maName);
    const name = (technical?.kind === 'group' ? technical.name : undefined) || item.name || technical?.name || assetNameFromHex(item.maName);
    const imageSrc = toIpfsUrl(item.image);
    const collectionName = collection?.name;

    return (
        <article className="surface group flex flex-col overflow-hidden transition-colors hover:border-line-strong hover:bg-base-300">
            <Link href={href} scroll={false} className="relative block aspect-square overflow-hidden bg-base-300">
                {imageSrc ? (
                    <IpfsImage
                        width="512"
                        height="512"
                        className="aspect-square w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                        src={imageSrc}
                        alt={name}
                    />
                ) : (
                    <TokenImagePlaceholder kind={technical?.kind} />
                )}
                {technical ? (
                    <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold ${technical.kind === 'royalty' ? 'bg-warning/90 text-warning-content' : 'bg-info/90 text-info-content'}`}>{technical.badge}</span>
                ) : null}
                {badge ? <span className="absolute right-2 top-2 rounded-full bg-base-100/85 px-2.5 py-1 text-xs font-semibold tabular-nums backdrop-blur">{badge}</span> : null}
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
                {technical ? <p className="text-xs text-base-content/55">{technical.note}</p> : null}
                <p className="mt-1 text-xs text-base-content/45">
                    {footer ?? (item.slotNo != null ? <LocalTime unix={slotToUnix(item.slotNo)} time /> : null)}
                </p>
            </div>
        </article>
    );
}

export default TokenCard;
