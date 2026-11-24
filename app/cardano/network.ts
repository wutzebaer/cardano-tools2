/**
 * The Cardano network the app works on, chosen at build time with NEXT_PUBLIC_CARDANO_NETWORK
 * (mainnet, preprod or preview). The chain data API has to point at a db-sync of the same network.
 */
export type NetworkName = "mainnet" | "preprod" | "preview";

export interface Network {
  name: NetworkName;
  /** Network id as reported by CIP-30 wallets and encoded in addresses: 1 = mainnet, 0 = any testnet */
  id: number;
  /** Unix time of slot 0, extrapolated from the Shelley era where 1 slot = 1 second */
  slotZeroUnix: number;
  /** Unix time at which `epochAtAnchor` started, and the length of an epoch since then */
  epochAnchorUnix: number;
  epochAtAnchor: number;
  epochSeconds: number;
  explorer: string;
}

export const NETWORKS: Record<NetworkName, Network> = {
  mainnet: { name: "mainnet", id: 1, slotZeroUnix: 1591566291, epochAnchorUnix: 1506203091, epochAtAnchor: 0, epochSeconds: 432000, explorer: "https://cexplorer.io" },
  // Byron ran for 4 epochs of 20 second slots, Shelley started in epoch 4 at slot 86400
  preprod: { name: "preprod", id: 0, slotZeroUnix: 1655683200, epochAnchorUnix: 1655769600, epochAtAnchor: 4, epochSeconds: 432000, explorer: "https://preprod.cexplorer.io" },
  // no Byron era, one day epochs
  preview: { name: "preview", id: 0, slotZeroUnix: 1666656000, epochAnchorUnix: 1666656000, epochAtAnchor: 0, epochSeconds: 86400, explorer: "https://preview.cexplorer.io" },
};

function configuredNetwork(): Network {
  const name = process.env.NEXT_PUBLIC_CARDANO_NETWORK || "mainnet";
  if (!(name in NETWORKS)) {
    throw new Error(`NEXT_PUBLIC_CARDANO_NETWORK must be one of ${Object.keys(NETWORKS).join(", ")}, not ${name}`);
  }
  return NETWORKS[name as NetworkName];
}

export const NETWORK = configuredNetwork();

export const IS_MAINNET = NETWORK.name === "mainnet";

export const unixToSlot = (unixSeconds: number, network: Network = NETWORK) => unixSeconds - network.slotZeroUnix;

export const slotToUnix = (slot: number, network: Network = NETWORK) => slot + network.slotZeroUnix;

export const unixToEpoch = (unixSeconds: number, network: Network = NETWORK) =>
  network.epochAtAnchor + Math.floor((unixSeconds - network.epochAnchorUnix) / network.epochSeconds);

/** When an epoch begins, in seconds since 1970. An epoch ends where the next one begins. */
export const epochStartUnix = (epoch: number, network: Network = NETWORK) => network.epochAnchorUnix + (epoch - network.epochAtAnchor) * network.epochSeconds;

export const currentSlot = () => Math.floor(unixToSlot(Date.now() / 1000));

export const currentEpoch = () => unixToEpoch(Date.now() / 1000);

export function slotToDate(slot: number) {
  return new Date(slotToUnix(slot) * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

export const explorerTxUrl = (txHash: string) => `${NETWORK.explorer}/tx/${txHash}`;

export const explorerAddressUrl = (address: string) => `${NETWORK.explorer}/address/${address}`;

export const explorerPoolUrl = (poolId: string) => `${NETWORK.explorer}/pool/${poolId}`;

export const explorerPolicyUrl = (policyId: string) => `${NETWORK.explorer}/policy/${policyId}`;

export const explorerAssetUrl = (fingerprint: string) => `${NETWORK.explorer}/asset/${fingerprint}`;
