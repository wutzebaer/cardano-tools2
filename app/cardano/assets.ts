import { TransactionUnspentOutput } from "@emurgo/cardano-serialization-lib-browser";

export interface WalletAsset {
  policyId: string;
  /** Asset name as hex */
  name: string;
  quantity: bigint;
  /** UTxOs holding this asset */
  utxos: TransactionUnspentOutput[];
}

export const assetKey = (policyId: string, name: string) => `${policyId}.${name}`;

/** All native assets in the given UTxOs, summed per asset. */
export function assetsInUtxos(utxos: TransactionUnspentOutput[]): WalletAsset[] {
  const assets = new Map<string, WalletAsset>();
  for (const utxo of utxos) {
    const multiAsset = utxo.output().amount().multiasset();
    if (!multiAsset) continue;
    const policies = multiAsset.keys();
    for (let p = 0; p < policies.len(); p++) {
      const policy = policies.get(p);
      const policyAssets = multiAsset.get(policy)!;
      const names = policyAssets.keys();
      for (let n = 0; n < names.len(); n++) {
        const assetName = names.get(n);
        const policyId = policy.to_hex();
        const name = Buffer.from(assetName.name()).toString("hex");
        const key = assetKey(policyId, name);
        const asset = assets.get(key) ?? { policyId, name, quantity: 0n, utxos: [] };
        asset.quantity += BigInt(policyAssets.get(assetName)!.to_str());
        asset.utxos.push(utxo);
        assets.set(key, asset);
      }
    }
  }
  return [...assets.values()];
}

export function lovelaceInUtxos(utxos: TransactionUnspentOutput[]) {
  return utxos.reduce((sum, utxo) => sum + BigInt(utxo.output().amount().coin().to_str()), 0n);
}
