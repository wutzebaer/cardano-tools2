"use server";

const MAX_FILE_BYTES = 104_857_600;

export async function uploadToIpfs(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Max 100mb");
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
    throw new Error(`IPFS add failed: ${response.status}`);
  }
  const result = (await response.json()) as { Hash?: string };
  if (!result.Hash) {
    throw new Error("IPFS add returned no hash");
  }
  return result.Hash;
}
