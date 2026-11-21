"use server";

export async function submitSignedTx(cborHex: string) {
  const response = await fetch("https://api.koios.rest/api/v1/submittx", {
    method: "POST",
    headers: { "Content-Type": "application/cbor" },
    body: Buffer.from(cborHex, "hex"),
  });
  const body = (await response.text()).trim().replaceAll('"', "");
  if (!response.ok) {
    throw new Error(body);
  }
  return body;
}
