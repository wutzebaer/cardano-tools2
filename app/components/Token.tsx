import React, { useEffect } from 'react'
import { components } from '../cardano/dbsync.schema';
import { getTokenDetails } from '@cardano/dbsync';

interface TokenProps {
    tokenListItem: components["schemas"]["TokenListItem"];
}

async function Token({ tokenListItem }: TokenProps) {
    const tokenDetails = await getTokenDetails(tokenListItem);
    return (
        <div>
            {tokenListItem.name}
            {tokenDetails.metadata}
        </div>
    )
}

export default Token
