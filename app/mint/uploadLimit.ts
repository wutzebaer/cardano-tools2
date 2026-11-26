/**
 * How much may be stored on the site's IPFS node within a day, no server or request involved.
 *
 * Uploads need no account, so without a limit anybody could fill the disk of the node. A visitor gets enough for the
 * largest drop the site allows, and all visitors together get what the node can take in a day.
 */
export interface UploadLimits {
  /** Files one visitor may store within a day */
  filesPerDay: number;
  /** Bytes one visitor may store within a day */
  bytesPerDay: number;
  /** Bytes all visitors together may store within a day */
  totalBytesPerDay: number;
}

const GB = 1_073_741_824;

/** A drop holds up to 10,000 tokens, each with a picture, and a creator may try more than once. */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = { filesPerDay: 25_000, bytesPerDay: 20 * GB, totalBytesPerDay: 100 * GB };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The limits with what the environment sets instead: a number of files, and sizes in GB. Anything that is no positive number is ignored. */
export function uploadLimitsFrom(env: Record<string, string | undefined>, defaults: UploadLimits = DEFAULT_UPLOAD_LIMITS): UploadLimits {
  const positive = (text: string | undefined) => {
    const value = Number(text);
    return text?.trim() && Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const files = positive(env.IPFS_UPLOAD_FILES_PER_DAY);
  const gb = positive(env.IPFS_UPLOAD_GB_PER_DAY);
  const totalGb = positive(env.IPFS_UPLOAD_TOTAL_GB_PER_DAY);
  return {
    filesPerDay: files ?? defaults.filesPerDay,
    bytesPerDay: gb === undefined ? defaults.bytesPerDay : gb * GB,
    totalBytesPerDay: totalGb === undefined ? defaults.totalBytesPerDay : totalGb * GB,
  };
}

interface Used {
  since: number;
  files: number;
  bytes: number;
}

/** Counts what was stored, per visitor and in total, each over a day that starts with its first upload. */
export class UploadMeter {
  private readonly visitors = new Map<string, Used>();
  private total: Used = { since: 0, files: 0, bytes: 0 };
  private readonly limits: UploadLimits;

  constructor(limits: UploadLimits) {
    this.limits = limits;
  }

  private current(used: Used | undefined, now: number): Used {
    return used && now - used.since < DAY_MS ? used : { since: now, files: 0, bytes: 0 };
  }

  /**
   * Counts an upload and returns nothing, or returns why it is refused, in words for the visitor, and counts nothing.
   * `visitor` tells visitors apart, the address a request came from.
   */
  admit(visitor: string, bytes: number, now: number = Date.now()): string | undefined {
    const own = this.current(this.visitors.get(visitor), now);
    const total = this.current(this.total, now);
    if (own.files + 1 > this.limits.filesPerDay || own.bytes + bytes > this.limits.bytesPerDay) {
      return "You have stored as much on IPFS as the site takes from one visitor within a day. Please try again tomorrow.";
    }
    if (total.bytes + bytes > this.limits.totalBytesPerDay) {
      return "The site has stored as much on IPFS as it takes within a day. Please try again tomorrow.";
    }
    own.files++;
    own.bytes += bytes;
    total.files++;
    total.bytes += bytes;
    this.visitors.set(visitor, own);
    this.total = total;
    // visitors whose day is over are forgotten, so the list does not grow for good
    if (this.visitors.size > 10_000) {
      for (const [key, used] of this.visitors) if (now - used.since >= DAY_MS) this.visitors.delete(key);
    }
    return undefined;
  }
}
