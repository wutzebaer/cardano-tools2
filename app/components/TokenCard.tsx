import { TokenListItem } from '@cardano/types';
import { shortenId, slotToDate, toIpfsUrl } from '@cardano/utils';
import IpfsImage from '@components/IpfsImage';
import Link from 'next/link';

function TokenCard({ item }: { item: TokenListItem }) {
    const href = `/browse/token/${item.maFingerprint}`;
    const name = item.name || item.maName;

    return (
        <article className="surface group flex flex-col overflow-hidden transition-colors hover:border-line-strong hover:bg-base-300">
            <Link href={href} scroll={false} className="relative block aspect-square overflow-hidden bg-base-300">
                <IpfsImage
                    width="512"
                    height="512"
                    className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    src={toIpfsUrl(item.image)}
                    alt={name}
                />
            </Link>
            <div className="flex flex-col gap-1 p-4">
                <Link
                    href={`/browse/search/${item.maPolicyId}`}
                    className="truncate font-mono text-[11px] text-base-content/50 hover:text-base-content"
                    title={item.maPolicyId}
                >
                    {shortenId(item.maPolicyId)}
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
