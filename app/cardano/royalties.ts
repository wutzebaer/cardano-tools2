import { applyPolicy, policyScript, policyTxOptions } from "@cardano/mint";
import { COINS_PER_UTXO_BYTE, sendTransaction, walletChangeAddress } from "@cardano/transaction";
import { MintPolicy, WalletConnection } from "@cardano/types";
import {
  Address,
  AssetName,
  BigNum,
  DataCost,
  Int,
  MetadataJsonSchema,
  MintBuilder,
  MintWitness,
  MultiAsset,
  NativeScriptSource,
  TransactionOutputBuilder,
} from "@emurgo/cardano-serialization-lib-browser";

const ROYALTY_LABEL = "777";
/** Transaction metadata strings are limited to 64 bytes. */
const METADATA_STRING_LIMIT = 64;

export function isValidAddress(address: string) {
  try {
    Address.from_bech32(address.trim());
    return true;
  } catch {
    return false;
  }
}

/** CIP-27 royalty metadata: rate as a fraction, address split into 64 character chunks. */
export function royaltyMetadata(percent: number, address: string) {
  const chunks = address.trim().match(new RegExp(`.{1,${METADATA_STRING_LIMIT}}`, "g")) ?? [];
  return { rate: String(percent / 100), addr: chunks.length === 1 ? chunks[0] : chunks };
}

/**
 * Mints the CIP-27 royalty token: one token with an empty asset name carrying the 777 metadata.
 * Marketplaces only honour it if it is the very first mint of the policy.
 */
export async function mintRoyaltyToken(connection: WalletConnection, policy: MintPolicy, percent: number, address: string, keyHashes: string[]) {
  const changeAddress = await walletChangeAddress(connection);
  const script = policyScript(policy);
  const royaltyName = AssetName.new(new Uint8Array());

  return sendTransaction(
    connection,
    (txBuilder) => {
      const mintBuilder = MintBuilder.new();
      mintBuilder.add_asset(MintWitness.new_native_script(NativeScriptSource.new(script)), royaltyName, Int.new_i32(1));

      const royaltyAsset = MultiAsset.new();
      royaltyAsset.set_asset(script.hash(), royaltyName, BigNum.one());
      txBuilder.add_output(
        TransactionOutputBuilder.new()
          .with_address(changeAddress)
          .next()
          .with_asset_and_min_required_coin_by_utxo_cost(royaltyAsset, DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE))
          .build()
      );

      txBuilder.set_mint_builder(mintBuilder);
      txBuilder.add_json_metadatum_with_schema(BigNum.from_str(ROYALTY_LABEL), JSON.stringify(royaltyMetadata(percent, address)), MetadataJsonSchema.NoConversions);
      applyPolicy(txBuilder, policy, keyHashes);
    },
    policyTxOptions(policy)
  );
}
