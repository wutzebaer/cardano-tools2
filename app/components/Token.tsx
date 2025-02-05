import { getTokenDetails } from '@cardano/dbsync';
import { parseMetadata, slotToDate, toDisplayMetadata, toIpfsUrl } from '@cardano/utils';
import Image from 'next/image';
import Link from 'next/link';
import { components } from '../cardano/dbsync.schema';
import IpfsImage from '@components/IpfsImage';

interface TokenProps {
    tokenListItem: components["schemas"]["TokenListItem"];
}

async function Token({ tokenListItem }: TokenProps) {
    const maxEntries = 6;
    const tokenDetails = await getTokenDetails(tokenListItem);
    const metadata = parseMetadata(tokenDetails.metadata);
    const displayMetadata = toDisplayMetadata(metadata);

    return (
        <div className="card bg-base-200 w-full md:w-80 xl:w-96">
            <figure>
                <Link href={`?query=${tokenListItem.maFingerprint}`} className='w-full'>
                    <IpfsImage width="384" height="384" className="aspect-square object-cover w-full" src={toIpfsUrl(metadata.image)} alt={metadata.name} />
                </Link>
            </figure>
            <div className="card-body">
                <h2 className="card-title">{metadata.name ?? tokenListItem.name}</h2>
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
                <div className="card-actions flex justify-between items-center">
                    <span>
                        <Link href={`https://pool.pm/${tokenListItem.maFingerprint}`} target='_blank'>
                            <Image src="/poolpm.ico" alt="pool.pm" width="20" height="20" />
                        </Link>
                    </span>
                    <span>{slotToDate(tokenListItem.slotNo!)}</span>
                </div>
            </div>
        </div>
    )
}

export default Token
