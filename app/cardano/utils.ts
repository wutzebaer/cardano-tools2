import { ImageError } from "next/dist/server/image-optimizer";

const SHELLEY_GENESIS_TIME = 1591566291; // Cardano mainnet genesis time in seconds (June 29, 2020, 21:44:51 UTC)

const IPFS_PROVIDERS = [
  //"https://ipfs.io/ipfs/",
  //"https://ipfs.blockfrost.dev/ipfs/",
  "https://cardano-tools.io/ipfs/",
  //'https://infura-ipfs.io/ipfs/',
];

export function formatAda(value?: number) {
  if (value == null) {
    return "";
  }
  const browserLocale = navigator.language || "en-US"; // Fallback zu "en-US"
  const formattedValue = new Intl.NumberFormat(browserLocale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value / 1000000);
  return `${formattedValue}\xa0₳`;
}

export function slotToDate(slotNo: number) {
  const timestamp = SHELLEY_GENESIS_TIME + slotNo;
  return new Date(timestamp * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

export function toIpfsUrl(ipfs: string) {
  if (!ipfs) {
    return ipfs;
  }

  if (Array.isArray(ipfs)) {
    ipfs = ipfs.join("");
  }

  if ((ipfs as string).startsWith("data:")) {
    return ipfs;
  }

  if ((ipfs as string).startsWith("http")) {
    return ipfs;
  }

  const ipfsProvider = IPFS_PROVIDERS[Math.floor(Math.random() * IPFS_PROVIDERS.length)];
  return ipfsProvider + ipfs.replace("ipfs://ipfs/", "").replace("ipfs://", "").replace("ipfs/", "");
}

export function errorToMessage(error: unknown): string {
  const e = error as Record<string, string>;
  return e?.message ?? e?.info ?? (e?.code ? `error: ${e.code}` : undefined) ?? e ?? "An unexpected error occurred.";
}
