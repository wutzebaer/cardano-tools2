import { getTokenDetails } from '@cardano/dbsync';
import { components } from '../cardano/dbsync.schema';

interface TokenProps {
    tokenListItem: components["schemas"]["TokenListItem"];
}

async function Token({ tokenListItem }: TokenProps) {
    const tokenDetails = await getTokenDetails(tokenListItem);
    //const tokenDetails: components["schemas"]["TokenDetails"] = await (await fetch(`http://localhost:8080/cardanoDbSyncApi/token/${tokenListItem.maPolicyId}/${tokenListItem.maName}`)).json();

    return (
        <div>
            {tokenListItem.name}
            {tokenDetails.metadata}
        </div>
    )
}

export default Token
