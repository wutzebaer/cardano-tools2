Cardano Tools is a [Next.js](https://nextjs.org) dApp: every transaction is built in the browser and signed by the user's CIP-30 wallet. There is no backend of its own, chain data comes from [cardano-db-sync-api](https://github.com/wutzebaer/cardano-db-sync-api).

## Pages

| Route | What it does |
| --- | --- |
| `/check` | Staking check of any address: pool status and fees, governance vote, rewards, with a shareable page per address |
| `/browse` | Latest tokens, search by policy id, fingerprint or `$handle`, token details with policy lock status |
| `/my` | Tokens of the connected wallet or any address |
| `/mint` | Mint CIP-68 NFTs and fungible tokens, one or many per transaction, with additional files and a JSON editor for the metadata |
| `/royalties` | Mint the CIP-27 royalty token of a policy |
| `/burn` | Burn tokens of own policies, including their CIP-68 reference NFT |
| `/timelock` | Lock ADA and tokens at a native script until a date and take them back afterwards |
| `/rewards` | Distribute ADA and tokens to the delegators of a pool |
| `/statement` | Wallet statement with fiat values and CSV export |
| `/pool` | The Cardano Tools pool [TOOLS] and delegation |

## Policies

A new policy is `all [sig <wallet payment key>, before <slot>]`, so the wallet signs for it and nothing secret has to be stored. Policies are found again through the wallet's mints on-chain; until the first mint they are kept in the browser's local storage.

Policies of the previous Cardano Tools had their key generated on the server. They can be imported on the mint page with script and signing key, which then stay in local storage and sign next to the wallet.
## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3333](http://localhost:3333). The home page rewrites to `/browse`.

Configuration in `.env`:

| Variable | Purpose |
| --- | --- |
| `CARDANO_DBSYNC_API_URL` | Base URL of cardano-db-sync-api, e.g. `http://localhost:8080/cardanoDbSyncApi` |
| `NEXT_PUBLIC_CARDANO_NETWORK` | `mainnet` (default), `preprod` or `preview`. Sets slot and epoch arithmetic, the network the wallet has to be on and the explorer links. The API has to serve a db-sync of the same network |
| `IPFS_API_URL` | IPFS node API used to upload and pin files while minting, e.g. `http://localhost:5001` |

Refresh the OpenAPI types after API changes:

```bash
npm run update-schema
```

## Checks

```bash
npm run lint
npm test        # reward distribution, statement, mint metadata, timelock script, staking check
npm run build
```

## Docker

```bash
docker build -t wutzebaer/cardano-tools2 .
docker run -p 3000:3000 -e CARDANO_DBSYNC_API_URL=http://cardano-db-sync-api:8080/cardanoDbSyncApi -e IPFS_API_URL=http://ipfs:5001 wutzebaer/cardano-tools2
```

The network is compiled in, a testnet image needs `--build-arg NEXT_PUBLIC_CARDANO_NETWORK=preview`. The build does not need the API.

## Releases

Images are tagged with the version from `package.json`, which the sidebar also shows. `scripts/release.sh` raises it (`patch` by default, or `minor` / `major`), tags the commit as `v1.2.3`, then builds and pushes `wutzebaer/cardano-tools2:1.2.3`.

## External services

Besides cardano-db-sync-api the app talks to the wallet, the IPFS node, Kraken's public market data (prices for the wallet statement), the Anvil API (collection names) and, only if the wallet fails to submit, Koios to submit a signed transaction.
