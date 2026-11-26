"use server";

import { Answer, answer, UserError } from "@cardano/answer";
import { MAX_FILE_BYTES } from "./fileLimits";

/** Stores a file on IPFS and answers with its hash. */
export async function uploadToIpfs(file: File): Promise<Answer<string>> {
  return answer(async () => {
    if (file.size > MAX_FILE_BYTES) {
      throw new UserError("Max 100mb");
    }
    const apiUrl = process.env.IPFS_API_URL?.replace(/\/$/, "");
    if (!apiUrl) {
      throw new Error("IPFS_API_URL is not set");
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
