"use server";

import { Answer, answer, UserError } from "@cardano/answer";
import { headers } from "next/headers";
import { MAX_FILE_BYTES } from "./fileLimits";
import { uploadLimitsFrom, UploadMeter } from "./uploadLimit";

/** One count for the server: it lives as long as the process does, a restart starts the day anew. */
const meter = new UploadMeter(uploadLimitsFrom(process.env));

/** Where a request came from, as the proxy in front of the site reports it. Requests without it share one allowance. */
async function visitor() {
  const sent = await headers();
  return sent.get("x-forwarded-for")?.split(",")[0].trim() || sent.get("x-real-ip") || "unknown";
}

/** Stores a file on IPFS and answers with its hash. */
export async function uploadToIpfs(file: File): Promise<Answer<string>> {
  return answer(async () => {
    if (file.size > MAX_FILE_BYTES) {
      throw new UserError("At most 100 MB per file");
    }
    const apiUrl = process.env.IPFS_API_URL?.replace(/\/$/, "");
    if (!apiUrl) {
      throw new Error("IPFS_API_URL is not set");
    }
    const refused = meter.admit(await visitor(), file.size);
    if (refused) {
      throw new UserError(refused);
    }

    const body = new FormData();
    body.append("file", file, file.name);

    const response = await fetch(`${apiUrl}/api/v0/add?pin=true&cid-version=0`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      throw new UserError(`The upload to IPFS failed (${response.status}). Please try again.`);
    }
    const result = (await response.json()) as { Hash?: string };
    if (!result.Hash) {
      throw new UserError("The upload to IPFS failed, it returned no hash. Please try again.");
    }
    return result.Hash;
  });
}
