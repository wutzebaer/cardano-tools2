import { getTokenDetails } from '@cardano/dbsync';
import { slotToDate, toIpfsUrl } from '@cardano/utils';
import Image from 'next/image';
import { components } from '../cardano/dbsync.schema';

interface TokenProps {
    tokenListItem: components["schemas"]["TokenListItem"];
}

async function Token({ tokenListItem }: TokenProps) {
    const tokenDetails = await getTokenDetails(tokenListItem);
    const metadata = tokenDetails.metadata ? JSON.parse(tokenDetails.metadata) : {};

    return (
        <div className="card bg-base-200 w-full md:w-80 xl:w-96 ">
            <figure>
                <Image width="384" height="384" className="skeleton object-cover w-full aspect-square" src={toIpfsUrl(metadata.image)} alt={metadata.name} />
            </figure>
            <div className="card-body">
                <h2 className="card-title">{metadata.name}</h2>
                <p>{metadata.description}</p>

                {/*  <pre>{JSON.stringify(metadata, null, 2)}</pre>
                <div className="card-actions justify-end">
                    <button className="btn btn-primary">Buy Now</button>
                </div> */}
                <div className="card-actions justify-end">
                    <span>{slotToDate(tokenListItem.slotNo!)}</span>
                </div>

            </div>
        </div>
    )
}

export default Token
