import { attestationHash, AttestedValue } from "@cardano/attestation";
import { policyScript } from "@cardano/mint";
import { MintPolicy } from "@cardano/types";
import { PrivateKey } from "@emurgo/cardano-serialization-lib-browser";

export const REGISTRY_REPOSITORY = "cardano-foundation/cardano-token-registry";

/** Limits of the Cardano token registry. */
export const REGISTRY_LIMITS = { name: 50, description: 500, ticker: { min: 2, max: 9 }, url: 250, decimals: 19, logoBytes: 65536 };

export interface RegistryFields {
  name: string;
  description: string;
  ticker?: string;
  url?: string;
  decimals?: number;
  /** PNG file content */
  logo?: Uint8Array;
}

interface RegistryProperty {
  sequenceNumber: number;
  value: string | number;
  signatures: { signature: string; publicKey: string }[];
}

export type RegistryEntry = { subject: string; policy: string } & Record<string, RegistryProperty | string>;

/** Subject of a token in the registry: policy id followed by the asset name, both hex. */
export const registrySubject = (policyId: string, assetNameHex: string) => policyId + assetNameHex;

/**
 * Builds the registry mapping for a token, every property signed with the policy key.
 * Only possible for policies whose raw signing key is in this browser: wallets cannot produce this signature.
 */
export function createRegistryEntry(policy: MintPolicy, assetNameHex: string, fields: RegistryFields, sequenceNumber = 0): RegistryEntry {
  if (!policy.skey) {
    throw new Error("The policy signing key is needed to sign a registry entry");
  }
  const privateKey = PrivateKey.from_hex(policy.skey);
  const publicKey = privateKey.to_public().to_hex();
  const subject = registrySubject(policy.policyId, assetNameHex);

  const property = (name: string, attested: AttestedValue, value: string | number): RegistryProperty => ({
    sequenceNumber,
    value,
    signatures: [{ signature: privateKey.sign(attestationHash(subject, name, attested, sequenceNumber)).to_hex(), publicKey }],
  });

  const entry: RegistryEntry = { subject, policy: policyScript(policy).to_hex() };
  entry.name = property("name", fields.name, fields.name);
  entry.description = property("description", fields.description, fields.description);
  if (fields.ticker) entry.ticker = property("ticker", fields.ticker, fields.ticker);
  if (fields.url) entry.url = property("url", fields.url, fields.url);
  if (fields.decimals != null) entry.decimals = property("decimals", fields.decimals, fields.decimals);
  if (fields.logo) entry.logo = property("logo", fields.logo, Buffer.from(fields.logo).toString("base64"));
  return entry;
}
