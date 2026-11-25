# Drop

A contract for an NFT drop that mints a token only when it is bought. Prototype, not audited, not used by the site yet.

## How it works

- **Create:** one transaction spends the seed output and puts the groups at the script address. Each group holds a marker token and a datum with the Merkle root of all tokens, the price, the seller and one bit per token.
- **Buy:** the buyer spends the group of the token and mints it in the same transaction. The contract checks that the token and its metadata belong to the drop, that it is not sold yet, that the price goes to the seller and that the group goes back with the token ticked off. The metadata stays at the script address (CIP-68).
- **Close:** the owner burns the marker of a group and takes its deposit back. A closed group cannot come back, so nothing more can be minted from it.
- **Burn (optional):** a drop is created either with or without the right to burn (`burnable`, the second parameter of the script, fixed for good). With it, whoever holds a token can burn it together with its metadata token and gets the deposit of the metadata back. The token stays ticked off, so it can never be bought again. Without it, only the owner can burn, and only while closing.

Token `n` belongs to group `n % groups`. Purchases in different groups do not get in each other's way.

Every group repeats the settings of the drop in its datum, including the two parameters of the script and where the list is published. So a page can show and use a drop knowing nothing but its policy id. All groups are created by one transaction, which holds at most 32 of them.

## What the contract does not check

- That every token of the list has its own name. Two entries with one name would mint the same token twice. Whoever creates the drop has to check the list, and buyers can read it.
- What the metadata says. It only checks that it is the metadata from the list.

## Building the list

The leaf of a token is `blake2b_256(00 ‖ hash of the metadata datum ‖ name)`. The contract hashes the metadata datum the way the chain writes Plutus data: lists open-ended, maps with a length, map entries in the order of the datum. A library that writes the datum differently (sorted keys, open-ended maps) produces another hash and every purchase is refused. `offchain/run.mjs` has an encoder that matches.

## Run against the preview testnet

`offchain/run.mjs` creates a drop of five tokens in two groups with a throwaway key, buys, burns, tries to cheat and closes. It reads the key from `/keys/preview-key.json` and talks to the public Koios API. It was written before the datum of a group got the script parameters and the list, so it no longer creates a valid drop; `offchain/site.mjs` is the current one.

## The site's code

The site builds its transactions in `app/cardano/dropTx.ts` with its own library. `offchain/site.mjs` runs exactly that code against the preview testnet, and with `--dry` prints what the scripts used, which is where the fixed budgets in `dropTx.ts` come from. `offchain/blueprint.mjs` writes the compiled contract into `app/cardano/dropBlueprint.ts`, run it after every `aiken build`.

## Build and test

Aiken v1.1.24, run in a container:

```sh
aiken check   # tests
aiken build   # writes plutus.json
```
