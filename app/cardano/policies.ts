import { MintPolicy } from "@cardano/types";

/**
 * Policies kept in this browser: freshly created ones that are not on-chain yet, and policies that were imported
 * together with their signing key while the mint page still offered that.
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
