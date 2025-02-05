import { getTokenDetails } from '@cardano/dbsync';
import { parseMetadata, slotToDate, toDisplayMetadata, toIpfsUrl } from '@cardano/utils';
import Image from 'next/image';
import Link from 'next/link';
import { components } from '../cardano/dbsync.schema';
import IpfsImage from '@components/IpfsImage';
import { getCollectionInfo } from '@cardano/jpg.store';
import { Verified } from '@components/JpgStoreIcons';

interface TokenProps {
    tokenListItem: components["schemas"]["TokenListItem"];
}

async function Token({ tokenListItem }: TokenProps) {
    const maxEntries = 5;
    const tokenDetails = await getTokenDetails(tokenListItem);
    const metadata = parseMetadata(tokenDetails.metadata);
    const displayMetadata = toDisplayMetadata(metadata);
    const collectionInfo = await getCollectionInfo(tokenListItem.maPolicyId);

    return (
        <div className="card bg-base-200 w-full md:w-80 xl:w-96">
            <figure>
                <Link href={`?query=${tokenListItem.maFingerprint}`} className='w-full'>
                    <IpfsImage width="384" height="384" className="aspect-square object-cover w-full" src={toIpfsUrl(metadata.image)} alt={metadata.name} />
                </Link>
            </figure>
            <div className="card-body">
                <h2 className="card-title">
                    <Link href={`?query=${tokenListItem.maFingerprint}`} className='link-hover'>
                        {metadata.name ?? tokenListItem.name}
                    </Link>
                </h2>
                <div className=''>{metadata.description}</div>
                <div className="grid p-2 grid-cols-1">
                    {Object.entries(displayMetadata)
                        .slice(0, maxEntries) // Limit to 5 entries
                        .map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                                <span className="max-w-[50%] truncate">{key}</span>
                                <span className="font-bold max-w-[50%] text-white truncate" title={value}>{value}</span>
                            </div>
                        ))}
                </div>
                <p>{/* spacer */}</p>
                {collectionInfo.is_verified &&
                    <div className="w-full truncate">
                        <Link href={`?query=${tokenListItem.maPolicyId}`} className="link-hover">
                            {collectionInfo.display_name}
                        </Link>
                    </div>
                }
                <div className="card-actions">
                    <div className="flex justify-between items-center w-full">
                        <span className="flex items-center gap-1">
                            <Link href={`https://pool.pm/${tokenListItem.maFingerprint}`} target='_blank'>
                                <Image src="/poolpm.ico" alt="pool.pm" width="20" height="20" />
                            </Link>
                            {collectionInfo.is_verified &&
                                <Link href={`https://www.jpg.store/collection/${collectionInfo.url}`} className="flex items-center truncate gap-2" target='_blank'>
                                    <Verified />
                                </Link>}
                        </span>
                        <span>{slotToDate(tokenListItem.slotNo!)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Token
