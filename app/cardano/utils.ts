const SHELLEY_GENESIS_TIME = 1591566291; // Cardano mainnet genesis time in seconds (June 29, 2020, 21:44:51 UTC)

const IPFS_PROVIDERS = [
  //"https://ipfs.io/ipfs/",
  //"https://ipfs.blockfrost.dev/ipfs/",
  "https://cardano-tools.io/ipfs/",
  //'https://infura-ipfs.io/ipfs/',
];

export function formatAda(value?: number) {
  const numberFormat = Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  if (value == null) {
    return "";
  }
  const formattedValue = numberFormat.format(value / 1000000);
  return `${formattedValue}\xa0₳`;
}

export function formatNumber(value?: number) {
  const numberFormat = Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (value == null) {
    return "";
  }
  return numberFormat.format(value);
}

export function shortenId(id: string, chars = 6) {
  return id.length > chars * 2 + 1 ? `${id.slice(0, chars)}…${id.slice(-chars)}` : id;
}

export function hexToUtf8(hex: string) {
  return Buffer.from(hex, "hex").toString("utf8");
}

/** CIP-67: `0` + 4-hex label + CRC-8 + `0`, then the asset name. */
function cip67Payload(hex: string) {
  if (hex.length >= 8 && hex[0] === "0" && hex[7] === "0") {
    const labelHex = hex.slice(1, 5);
    const crcHex = hex.slice(5, 7);
    if (crc8(Buffer.from(labelHex, "hex")) === parseInt(crcHex, 16)) {
      return { label: parseInt(labelHex, 16), nameHex: hex.slice(8) };
    }
  }
}

export function cip67Label(hex: string) {
  return cip67Payload(hex)?.label;
}

export function assetNameFromHex(hex: string) {
  const labeled = cip67Payload(hex);
  return hexToUtf8(labeled ? labeled.nameHex : hex);
}

function crc8(bytes: Uint8Array) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x80) !== 0 ? (crc << 1) ^ 0x07 : crc << 1;
      crc &= 0xff;
    }
  }
  return crc;
}

export function formatTokenAmount(value?: number, decimals = 0) {
  if (value == null) {
    return "";
  }
  const amount = decimals > 0 ? value / 10 ** decimals : value;
  return Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function slotToDate(slotNo: number) {
  const timestamp = SHELLEY_GENESIS_TIME + slotNo;
  return new Date(timestamp * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export function toIpfsUrl(ipfs?: string | string[] | null) {
  if (!ipfs) {
    return "";
  }

  const uri = Array.isArray(ipfs) ? ipfs.join("") : ipfs;

  if (uri.startsWith("data:") || uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }

  if (uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.slice("ar://".length)}`;
  }

  const ipfsProvider = IPFS_PROVIDERS[Math.floor(Math.random() * IPFS_PROVIDERS.length)];
  return ipfsProvider + uri.replace("ipfs://ipfs/", "").replace("ipfs://", "").replace("ipfs/", "");
}

export function errorToMessage(e: unknown): string {
  let error = e as Record<string, unknown>;
  const messages: string[] = [];
  do {
    const message = String(error.digest || error.message || error.info || error.code || error);
    if (message) messages.push(message);
    error = error.cause as Record<string, unknown>;
  } while (error);
  return messages.length > 0 ? messages.join(", ") : "An unexpected error occurred.";
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseMetadata(metadata: unknown, policyId?: string, assetNameHex?: string) {
  try {
    return flattenAndTransform(unwrapCip68Metadata(JSON.parse(metadata as string), policyId, assetNameHex));
  } catch {
    return {};
  }
}

/** CIP-68 v4 / CIP-25: metadata lives at `721[policy_id][asset_name]` (asset name without CIP-67 prefix). */
function unwrapCip68Metadata(obj: unknown, policyId?: string, assetNameHex?: string): unknown {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }
  const nested = (obj as Record<string, unknown>)["721"];
  if (nested == null || typeof nested !== "object" || Array.isArray(nested)) {
    return obj;
  }
  const policies = nested as Record<string, unknown>;
  const policy = (policyId ? Object.entries(policies).find(([key]) => metadataKeyMatches(key, policyId))?.[1] : undefined) ?? Object.values(policies)[0];
  if (policy == null || typeof policy !== "object" || Array.isArray(policy)) {
    return obj;
  }
  const assets = policy as Record<string, unknown>;
  const nameHex = cip67Payload(assetNameHex ?? "")?.nameHex ?? assetNameHex;
  const asset =
    (nameHex ? Object.entries(assets).find(([key]) => metadataKeyMatches(key, nameHex, hexToUtf8(nameHex)))?.[1] : undefined) ??
    Object.values(assets).find((value) => value != null && typeof value === "object" && !Array.isArray(value));
  return asset ?? obj;
}

function metadataKeyMatches(key: string, expectedHex: string, expectedUtf8 = expectedHex) {
  const k = key.toLowerCase();
  if (k === expectedHex.toLowerCase() || k === expectedUtf8.toLowerCase()) {
    return true;
  }
  return hexToUtf8(key).toLowerCase() === expectedUtf8.toLowerCase();
}

function metadataText(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join("");
  }
  return "";
}

export function tokenImage(metadata: Record<string, unknown>) {
  return metadataText(metadata.image) || metadataText(metadata.logo);
}

export function tokenFiles(metadata: Record<string, unknown>, image?: string) {
  const files = new Map<string, { name: string; mediaType: string; src: string }>();
  for (const [key, value] of Object.entries(metadata)) {
    const match = key.match(/^files \/ (\d+) \/ (name|mediaType|src)$/);
    if (!match || typeof value !== "string") {
      continue;
    }
    const item = files.get(match[1]) ?? { name: "", mediaType: "", src: "" };
    item[match[2] as "name" | "mediaType" | "src"] = value;
    files.set(match[1], item);
  }
  return [...files.values()].filter((file) => file.src && file.src !== image);
}

export function metadataDecimals(metadata: Record<string, unknown>) {
  const value = metadata.decimals;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number(value.replaceAll(",", ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isJoinedTextPath(path: string[]) {
  const last = path.at(-1);
  return last === "name" || last === "image" || last === "description" || last === "logo" || last === "mediaType" || last === "src";
}

function flattenAndTransform(obj: ReturnType<typeof JSON.parse>, path: string[] = []): ReturnType<typeof JSON.parse> {
  if (Array.isArray(obj)) {
    // CIP-25: name/image/description (and similar) may be split across strings
    if (obj.length > 0 && obj.every((item) => typeof item === "string") && isJoinedTextPath(path)) {
      return { [path.join(" / ")]: obj.join("") };
    }
    return Object.assign({}, ...obj.map((item, index) => flattenAndTransform(item, [...path, index.toString()])));
  } else if (typeof obj === "object") {
    // Wenn es ein Objekt ist, verarbeite jedes Schlüssel-Wert-Paar rekursiv
    return Object.assign({}, ...Object.entries(obj).map(([key, value]) => flattenAndTransform(value, [...path, key])));
  } else if (typeof obj === "number") {
    // Formatiere Zahlen mit formatNumber
    return { [path.join(" / ")]: formatNumber(obj) };
  }
  // Andernfalls gib den Wert mit dem aktuellen Pfad als Schlüssel zurück
  return { [path.join(" / ")]: obj };
}

export function toDisplayMetadata(metadata: ReturnType<typeof JSON.parse>): object {
  if (metadata.properties) {
    return metadata.properties;
  }
  if (metadata.attributes) {
    return metadata.attributes;
  }
  const RESERVED_METADATA_FIELDS = ["name", "description", "files", "image", "logo", "mediaType"];
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => !RESERVED_METADATA_FIELDS.some((field) => key.startsWith(field)) && typeof value !== "object"));
}
