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

export function slotToDate(slotNo: number) {
  const timestamp = SHELLEY_GENESIS_TIME + slotNo;
  return new Date(timestamp * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseMetadata(metadata: unknown) {
  try {
    return flattenAndTransform(JSON.parse(metadata as string));
  } catch {
    return {};
  }
}

function flattenAndTransform(obj: ReturnType<typeof JSON.parse>, path: string[] = []): ReturnType<typeof JSON.parse> {
  if (Array.isArray(obj)) {
    // Wenn es ein Array von Strings ist, verbinde sie zu einem String
    if (obj.every((item) => typeof item === "string")) {
      return { [path.join(" / ")]: obj.join("") };
    }
    // Ansonsten verarbeite jedes Element einzeln und flache es weiter ab
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
  const RESERVED_METADATA_FIELDS = ["name", "description", "files", "image", "mediaType"];
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => !RESERVED_METADATA_FIELDS.some((field) => key.startsWith(field)) && typeof value !== "object"));
}
