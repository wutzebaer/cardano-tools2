"use server";

/**
 * Submits a signed transaction through a public endpoint. The node's answer comes back as a value:
 * the message of an error thrown here would not reach the browser in production.
 */
export async function submitSignedTx(cborHex: string): Promise<{ ok: boolean; body: string }> {
  const response = await fetch("https://api.koios.rest/api/v1/submittx", {
    method: "POST",
    headers: { "Content-Type": "application/cbor" },
    body: Buffer.from(cborHex, "hex"),
  });
  const body = (await response.text()).trim().replaceAll('"', "");
  return { ok: response.ok, body };
}
