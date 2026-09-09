import { getTokenDetailsByFingerprint } from '@cardano/dbsync';
import { TokenListItem } from '@cardano/types';
import { parseMetadata, slotToDate, toDisplayMetadata, toIpfsUrl } from '@cardano/utils';
import { getCollectionInfo } from '@cardano/wayup';
import IpfsImage from '@components/IpfsImage';
import { Verified } from '@components/JpgStoreIcons';
import Image from 'next/image';
import Link from 'next/link';

type TokenProps = {
    className?: string;
} & (
    | { fingerprint: string; maxEntries?: number; item?: never }
    | { item: TokenListItem; fingerprint?: never; maxEntries?: never }
);

async function Token({ fingerprint, item, maxEntries = 5, className = 'w-full md:w-80 xl:w-96' }: TokenProps) {
    const tokenDetails = fingerprint
        ? await getTokenDetailsByFingerprint(fingerprint)
        : undefined;
    const metadata = tokenDetails ? parseMetadata(tokenDetails.metadata) : {};
    const displayMetadata = tokenDetails ? toDisplayMetadata(metadata) : {};
    const policyId = tokenDetails?.maPolicyId ?? item?.maPolicyId ?? '';
    const tokenFingerprint = tokenDetails?.fingerprint ?? item?.maFingerprint ?? '';
    const collectionInfo = tokenDetails ? await getCollectionInfo(policyId) : {};
    const name =
      (typeof metadata.name === 'string' ? metadata.name : undefined) ??
      tokenDetails?.maName ??
      item?.name ??
      item?.maName ??
      '';
    const image =
      (typeof metadata.image === 'string' ? metadata.image : undefined) ??
      item?.image ??
      '';
    const slotNo = tokenDetails?.slotNo ?? item?.slotNo;

    return (
        <div className={`card bg-base-200 break-words ${className}`}>
            <figure>
                <Link href={`/browse/token/${tokenFingerprint}`} className='w-full' scroll={false}>
                    <IpfsImage width="576" height="576" className="aspect-square object-cover w-full" src={toIpfsUrl(image)} alt={name} />
                </Link>
            </figure>
            <div className="card-body">
                <h2 className="card-title">
                    <Link href={`/browse/token/${tokenFingerprint}`} className='link-hover truncate'>
                        {name}
                    </Link>
                </h2>
                {typeof metadata.description === 'string' ? <div>{metadata.description}</div> : null}
                <div className="grid grid-cols-1">
                    {Object.entries(displayMetadata)
                        .slice(0, maxEntries)
                        .map(([key, value]) => {
                            const text = String(value ?? '');
                            return (
                                <div key={key} className="flex justify-between">
                                    <span className="max-w-[50%] truncate capitalize">{key}</span>
                                    <span className="font-bold max-w-[50%] truncate" title={text}>
                                        {text.startsWith("http") ? (
                                            <Link href={text} target="_blank" className="link-hover">
                                                {text}
                                            </Link>
                                        ) : (text)}
                                    </span>
                                </div>
                            );
                        })}
                </div>
                <p>{/* spacer */}</p>
                <div className="w-3/4 truncate">
                    <Link href={`/browse/search/${policyId}`} className="link-hover">
                        {collectionInfo.name ?? policyId}
                    </Link>
                </div>
                <div className="card-actions">
                    <div className="flex justify-between items-center w-full">
                        <span className="flex items-center gap-1">
                            <Link href={`https://pool.pm/${tokenFingerprint}`} target='_blank'>
                                <Image src="/poolpm.ico" alt="pool.pm" width="20" height="20" />
                            </Link>
                            <Link href={`https://www.wayup.io/collection/${collectionInfo.handle ?? policyId}`} className="flex items-center truncate gap-2" target='_blank'>
                                {collectionInfo.verified ? <Verified /> : <span className="text-xs">Wayup</span>}
                            </Link>
                        </span>
                        <span>{slotNo != null ? slotToDate(slotNo) : null}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Token
