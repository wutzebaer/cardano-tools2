import { getTokenDetailsByFingerprint } from '@cardano/dbsync';
import { getCollectionInfo } from '@cardano/jpg.store';
import { parseMetadata, slotToDate, toDisplayMetadata, toIpfsUrl } from '@cardano/utils';
import IpfsImage from '@components/IpfsImage';
import { Verified } from '@components/JpgStoreIcons';
import Image from 'next/image';
import Link from 'next/link';

interface TokenProps {
    className?: string;
    fingerprint: string;
    maxEntries?: number;
}

async function Token({ fingerprint, maxEntries = 5, className = 'w-full md:w-80 xl:w-96' }: TokenProps) {
    const tokenDetails = await getTokenDetailsByFingerprint(fingerprint);
    const metadata = parseMetadata(tokenDetails.metadata);
    const displayMetadata = toDisplayMetadata(metadata);
    const collectionInfo = await getCollectionInfo(tokenDetails.maPolicyId);

    return (
        <div className={`card bg-base-200 break-words ${className}`}>
            <figure>
                <Link href={`/browse/token/${tokenDetails.fingerprint}`} className='w-full' scroll={false}>
                    <IpfsImage width="576" height="576" className="aspect-square object-cover w-full" src={toIpfsUrl(metadata.image)} alt={metadata.name} />
                </Link>
            </figure>
            <div className="card-body">
                <h2 className="card-title">
                    <Link href={`/browse/token/${tokenDetails.fingerprint}`} className='link-hover truncate'>
                        {metadata.name ?? tokenDetails.maName}
                    </Link>
                </h2>
                <div>{metadata.description}</div>
                <div className="grid grid-cols-1">
                    {Object.entries(displayMetadata)
                        .slice(0, maxEntries) // Limit to maxEntries
                        .map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                                <span className="max-w-[50%] truncate capitalize">{key}</span>
                                <span className={`font-bold max-w-[50%] text-white truncate`} title={value}>
                                    {value.startsWith("http") ? (
                                        <Link href={value} target="_blank" className="link-hover">
                                            {value}
                                        </Link>
                                    ) : (value)}
                                </span>
                            </div>
                        ))}
                </div>
                <p>{/* spacer */}</p>
                <div className="w-3/4 truncate">
                    <Link href={`/browse/search/${tokenDetails.maPolicyId}`} className="link-hover">
                        {collectionInfo.display_name ?? tokenDetails.maPolicyId}
                    </Link>
                </div>
                <div className="card-actions">
                    <div className="flex justify-between items-center w-full">
                        <span className="flex items-center gap-1">
                            <Link href={`https://pool.pm/${tokenDetails.fingerprint}`} target='_blank'>
                                <Image src="/poolpm.ico" alt="pool.pm" width="20" height="20" />
                            </Link>
                            {collectionInfo.is_verified &&
                                <Link href={`https://www.jpg.store/collection/${collectionInfo.url}`} className="flex items-center truncate gap-2" target='_blank'>
                                    <Verified />
                                </Link>}
                        </span>
                        <span>{slotToDate(tokenDetails.slotNo!)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Token
