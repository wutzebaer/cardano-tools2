// Stands in for cardano-db-sync-api and the IPFS node so the site can run against the preview testnet:
// the endpoints the drop pages use, answered from the public Koios API of preview, and a file store
// that speaks the two IPFS calls the site makes. Everything else answers empty. For looking at the pages only.
//
//   node preview-api.mjs        listens on port 4444, keeps uploaded files in ./preview-files
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const KOIOS = "https://preview.koios.rest/api/v1";
const FILES = new URL("./preview-files/", import.meta.url);
mkdirSync(FILES, { recursive: true });

async function koios(path, body) {
  const response = await fetch(KOIOS + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

/** One row for the ADA of an output and one per token, as the API answers. */
function rowsOf(output, spent) {
  const base = { txHash: output.tx_hash, txIndex: output.tx_index, spent };
  const assets = Array.isArray(output.asset_list) ? output.asset_list : [];
  return [
    { ...base, value: Number(output.value), datum: output.inline_datum?.bytes ?? null },
    ...assets.map((asset) => ({ ...base, maPolicyId: asset.policy_id, maName: asset.asset_name ?? "", value: Number(asset.quantity) })),
  ];
}

async function scriptOutputs(scriptHash, namePrefix) {
  const outputs = await koios("/credential_utxos", { _payment_credentials: [scriptHash], _extended: true });
  return outputs
    .filter((output) => !output.is_spent && (Array.isArray(output.asset_list) ? output.asset_list : []).some((asset) => asset.policy_id === scriptHash && (asset.asset_name ?? "").startsWith(namePrefix)))
    .flatMap((output) => rowsOf(output, false));
}

async function firstOutputs(scriptHash) {
  const txs = await koios("/credential_txs", { _payment_credentials: [scriptHash] });
  if (txs.length === 0) return [];
  const first = txs.reduce((a, b) => (a.block_height <= b.block_height ? a : b));
  const [info] = await koios("/tx_info", { _tx_hashes: [first.tx_hash], _inputs: false, _metadata: false, _assets: true, _withdrawals: false, _certs: false, _scripts: true, _bytecode: false });
  return (info?.outputs ?? []).filter((output) => output.payment_addr?.cred === scriptHash).flatMap((output) => rowsOf({ ...output, tx_hash: first.tx_hash }, true));
}

function body(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** The content of the first file of a multipart upload. */
function uploadedFile(buffer) {
  const start = buffer.indexOf("\r\n\r\n") + 4;
  const boundary = buffer.subarray(0, buffer.indexOf("\r\n"));
  return buffer.subarray(start, buffer.indexOf(Buffer.concat([Buffer.from("\r\n"), boundary]), start));
}

createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const send = (status, value, type = "application/json") => {
    response.writeHead(status, { "content-type": type });
    response.end(type === "application/json" ? JSON.stringify(value) : value);
  };
  try {
    let match;
    if ((match = url.pathname.match(/^\/script\/([0-9a-f]{56})\/outputs$/))) return send(200, await scriptOutputs(match[1], url.searchParams.get("namePrefix") ?? ""));
    if ((match = url.pathname.match(/^\/script\/([0-9a-f]{56})\/firstOutputs$/))) return send(200, await firstOutputs(match[1]));
    if (url.pathname === "/costModel/plutusV3") return send(200, (await koios("/cli_protocol_params")).costModels.PlutusV3);
    if ((match = url.pathname.match(/^\/transaction\/([0-9a-f]{64})\/confirmed$/))) {
      const [status] = await koios("/tx_status", { _tx_hashes: [match[1]] });
      return send(200, (status?.num_confirmations ?? 0) >= 1);
    }
    if (url.pathname === "/api/v0/add") {
      const file = uploadedFile(await body(request));
      // not a real content id, only shaped like one
      const hash = "Qm" + createHash("sha256").update(file).digest("hex").slice(0, 44);
      writeFileSync(new URL(hash, FILES), file);
      return send(200, { Hash: hash });
    }
    if (url.pathname === "/api/v0/cat") {
      const file = new URL(url.searchParams.get("arg").replace(/[^A-Za-z0-9]/g, ""), FILES);
      return existsSync(file) ? send(200, readFileSync(file), "application/octet-stream") : send(404, { error: "unknown file" });
    }
    await body(request);
    return send(200, []);
  } catch (error) {
    console.error(`${url.pathname}: ${error.message}`);
    send(500, { error: "preview source failed" });
  }
}).listen(4444, () => console.log("preview stand-in listening on 4444"));
