/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
    "/lastMint": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Get last minted tokens for stakeAddress and policy ids */
        post: operations["getLastMint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{stakeAddress}/stakeInfo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get infos where address is staked to */
        get: operations["getStakeInfo"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{stakeAddress}/returnAddress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Find the first known address with the same stake address, which should not be mangled */
        get: operations["getReturnAddress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{stakeAddress}/handles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get all handles from a stakeAddress */
        get: operations["getHandles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{address}/utxos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Find utxos of given address or stakeAddress including multi assets */
        get: operations["getUtxos"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{address}/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** getAddressTokenList */
        get: operations["getAddressTokenList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{address}/statement": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get all transactions for an address or stakeAddress */
        get: operations["getStatement"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/{address}/stakeAddress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Find stakeAddress of address */
        get: operations["getStakeAddress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/transaction/{txId}/outputs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get ada outputs if tx */
        get: operations["getTransactionOutputs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/transaction/{txId}/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get json metadata of tx */
        get: operations["getTransactionMetadata"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/transaction/{txId}/confirmed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Checks is a txid has been included in the chain */
        get: operations["isTransactionConfirmed"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** getTokenList */
        get: operations["getTokenList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/token/{policyId}/{assetName}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** getTokenDetails */
        get: operations["getTokenDetails"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/token/{fingerprint}/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** getTokenDetailsByFingerprint */
        get: operations["getTokenDetails_1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/tip": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Returns current tip of db */
        get: operations["getTip"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stakeHash/{stakeAddress}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Find stakeAddressHash by stakeAddress */
        get: operations["getStakeHashByAddress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stakeAddress/{stakeAddressHash}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Find stakeAddress by stakeAddressHash */
        get: operations["getStakeAddressByHash"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/poolList": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** getPoolList */
        get: operations["getPoolList"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/policy/{policyId}/owners": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get all token owners of a policyId, values get updated twice a day */
        get: operations["getOwners"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/minswap/{policyId}/{assetName}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get minswap pools for token */
        get: operations["getMinswapPools"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/handles/{handle}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get address for handle */
        get: operations["getAddressByHandle"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/epochStake/{poolHash}/{epoch}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** getEpochStake */
        get: operations["getEpochStake"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        GetLastMintRequest: {
            stakeAddress?: string;
            policyIds?: string[];
        };
        TokenDetails: {
            /** Format: int64 */
            slotNo: number;
            maPolicyId: string;
            maName: string;
            fingerprint: string;
            metadata?: string;
            maPolicyScript: string;
            txHash: string;
            /** Format: int64 */
            totalSupply: number;
        };
        StakeInfo: {
            /** Format: int64 */
            stake: number;
            poolHash: string;
            tickerName: string;
            /** Format: int64 */
            totalStake: number;
        };
        ReturnAddress: {
            address?: string;
        };
        StakeAddress: {
            address?: string;
        };
        Utxo: {
            txHash: string;
            /** Format: int32 */
            txIndex: number;
            maPolicyId?: string;
            maName?: string;
            /** Format: int64 */
            value: number;
            owningAddress: string;
            sourceAddress: string;
        };
        TokenListItem: {
            /** Format: int64 */
            maMintId?: number;
            /** Format: int64 */
            slotNo?: number;
            maPolicyId: string;
            maName: string;
            maFingerprint: string;
            /** Format: int64 */
            quantity: number;
            name: string;
            image: string;
        };
        AccountStatementRow: {
            /** Format: date-time */
            timestamp: string;
            /** Format: int32 */
            epoch: number;
            txHash: string;
            /** Format: int64 */
            withdrawn: number;
            /** Format: int64 */
            rewards: number;
            /** Format: int64 */
            out: number;
            /** Format: int64 */
            in: number;
            /** Format: int64 */
            change: number;
            /** Format: int64 */
            sum: number;
            operations: string[];
        };
        TxOut: {
            targetAddress: string;
            /** Format: int64 */
            value: number;
        };
        PoolInfo: {
            tickerName: string;
            poolHash: string;
        };
        OwnerInfo: {
            address: string;
            /** Format: int64 */
            amount: number;
            maNames: string[];
        };
        LiquidityPool: {
            assetA?: components["schemas"]["Utxo"];
            assetB?: components["schemas"]["Utxo"];
        };
        EpochStake: {
            stakeAddress: string;
            /** Format: int64 */
            amount: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getLastMint: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /** @example {
                 *       "stakeAddress": "stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn",
                 *       "policyIds": [
                 *         "38e97ac082af9312c69c9e2b0949c0d7873f0bbca34b0a8905ec2441"
                 *       ]
                 *     } */
                "application/json": components["schemas"]["GetLastMintRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenDetails"][];
                };
            };
        };
    };
    getStakeInfo: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn */
                stakeAddress: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StakeInfo"];
                };
            };
        };
    };
    getReturnAddress: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn */
                stakeAddress: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReturnAddress"];
                };
            };
        };
    };
    getHandles: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn */
                stakeAddress: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StakeAddress"][];
                };
            };
        };
    };
    getUtxos: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn */
                address: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Utxo"][];
                };
            };
        };
    };
    getAddressTokenList: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn */
                address: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenListItem"][];
                };
            };
        };
    };
    getStatement: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn */
                address: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountStatementRow"][];
                };
            };
        };
    };
    getStakeAddress: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example addr1qx8lsj4menq5s7w5f8jupm64n9d3aamvcppllujwse473636fhhttcg3x8kfhm6qqpvujfhgmu8jww3mfn49m3fkjssqhx0348 */
                address: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StakeAddress"];
                };
            };
        };
    };
    getTransactionOutputs: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example a6ca444bd39cb51c7e997a9cead4a8071e2f7e5d1579ac4194b6aaaba923bc58 */
                txId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TxOut"][];
                };
            };
        };
    };
    getTransactionMetadata: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example a6ca444bd39cb51c7e997a9cead4a8071e2f7e5d1579ac4194b6aaaba923bc58 */
                txId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string;
                };
            };
        };
    };
    isTransactionConfirmed: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example a6ca444bd39cb51c7e997a9cead4a8071e2f7e5d1579ac4194b6aaaba923bc58 */
                txId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": boolean;
                };
            };
        };
    };
    getTokenList: {
        parameters: {
            query?: {
                afterMintid?: number;
                beforeMintid?: number;
                /** @example 89267e9a35153a419e1b8ffa23e511ac39ea4e3b00452e9d500f2982 */
                filter?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenListItem"][];
                };
            };
        };
    };
    getTokenDetails: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example 89267e9a35153a419e1b8ffa23e511ac39ea4e3b00452e9d500f2982 */
                policyId: string;
                /** @example 436176616c6965724b696e67436861726c6573 */
                assetName: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenDetails"];
                };
            };
        };
    };
    getTokenDetails_1: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example asset1r9v95ujk83kx90lr3g8cd0uqu5de3kqjptp7sm */
                fingerprint: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TokenDetails"];
                };
            };
        };
    };
    getTip: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": number;
                };
            };
        };
    };
    getStakeHashByAddress: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example stake1u8wmu7jc0e4a6fn5haflczfjy6aagwhsxh6w5p7hsyt8jeshhy0rn */
                stakeAddress: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StakeAddress"];
                };
            };
        };
    };
    getStakeAddressByHash: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example e1ddbe7a587e6bdd2674bf53fc093226bbd43af035f4ea07d781167966 */
                stakeAddressHash: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StakeAddress"];
                };
            };
        };
    };
    getPoolList: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PoolInfo"][];
                };
            };
        };
    };
    getOwners: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example 89267e9a35153a419e1b8ffa23e511ac39ea4e3b00452e9d500f2982 */
                policyId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OwnerInfo"][];
                };
            };
        };
    };
    getMinswapPools: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example 89267e9a35153a419e1b8ffa23e511ac39ea4e3b00452e9d500f2982 */
                policyId: string;
                /** @example 436176616c6965724b696e67436861726c6573 */
                assetName: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LiquidityPool"][];
                };
            };
        };
    };
    getAddressByHandle: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example petergrossmann */
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StakeAddress"];
                };
            };
        };
    };
    getEpochStake: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @example pool180fejev4xgwe2y53ky0pxvgxr3wcvkweu6feq5mdljfzcsmtg6u */
                poolHash: string;
                /** @example 432 */
                epoch: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EpochStake"][];
                };
            };
        };
    };
}
