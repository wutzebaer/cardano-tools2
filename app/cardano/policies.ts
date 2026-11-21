import { scriptKeyHashes } from "@cardano/mint";
import { toNativeScript } from "@cardano/transaction";
import { MintPolicy, SimpleScript } from "@cardano/types";
import { PrivateKey } from "@emurgo/cardano-serialization-lib-browser";

/**
 * Policies kept in this browser: freshly created ones that are not on-chain yet,
 * and policies imported from the old Cardano Tools together with their signing key.
 */
const STORAGE_KEY = "policies";

export function loadStoredPolicies(): MintPolicy[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveStoredPolicies(policies: MintPolicy[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(policies));
}

export function storePolicy(policy: MintPolicy) {
  saveStoredPolicies([...loadStoredPolicies().filter((stored) => stored.policyId !== policy.policyId), policy]);
}

export function removeStoredPolicy(policyId: string) {
  saveStoredPolicies(loadStoredPolicies().filter((stored) => stored.policyId !== policyId));
}

/**
 * Accepts a cardano-cli key file (`{"type": "PaymentSigningKeyShelley_ed25519", "cborHex": "5820…"}`),
 * its cborHex or the raw 32 byte key as hex. Returns the raw key as hex.
 */
export function parseSigningKey(input: string) {
  let hex = input.trim();
  if (hex.startsWith("{")) {
    hex = String(JSON.parse(hex).cborHex ?? "");
  }
  hex = hex.toLowerCase();
  if (hex.length === 68 && hex.startsWith("5820")) {
    hex = hex.slice(4);
  }
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error("Signing key must be a cardano-cli .skey file or 32 bytes of hex");
  }
  return hex;
}

/** Validates script and key of a policy created elsewhere and returns it ready to be stored. */
export function importPolicy(name: string, scriptJson: string, signingKey: string): MintPolicy {
  let script: SimpleScript;
  try {
    script = JSON.parse(scriptJson);
  } catch {
    throw new Error("Policy script is not valid JSON");
  }
  const policyId = toNativeScript(script).hash().to_hex();
  const skey = parseSigningKey(signingKey);
  const keyHash = PrivateKey.from_hex(skey).to_public().hash().to_hex();
  if (!scriptKeyHashes(script).includes(keyHash)) {
    throw new Error("The signing key does not belong to this policy script");
  }
  return { policyId, script, skey, name: name.trim() || undefined };
}
