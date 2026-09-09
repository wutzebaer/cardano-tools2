This is a [Next.js](https://nextjs.org) app for browsing Cardano tokens, minting, and staking to [CHIEN].

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3333](http://localhost:3333). The home page rewrites to `/browse`.

The token API defaults to `http://localhost:8080/cardanoDbSyncApi`. Override with `CARDANO_DBSYNC_API_URL` in `.env`. Refresh the OpenAPI types after API changes:

```bash
npm run update-schema
```
