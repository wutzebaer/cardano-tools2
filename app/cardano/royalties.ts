import { NETWORK } from "@cardano/network";
import { applyPolicy, policyScript, policyTxOptions } from "@cardano/mint";
import { policyRegistration, REGISTRATION_LABEL } from "@cardano/registration";
import { currentSlot, dataCost, sendTransaction, walletChangeAddress } from "@cardano/transaction";
import { MintPolicy, WalletConnection } from "@cardano/types";
import {
  Address,
  AssetName,
  BigNum,
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
    return Address.from_bech32(address.trim()).network_id() === NETWORK.id;
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
 * With a collection name the transaction registers it as well (CIP-88), the token is the proof that the owner did.
 */
export async function mintRoyaltyToken(connection: WalletConnection, policy: MintPolicy, percent: number, address: string, keyHashes: string[], collection?: { name: string; description?: string; image?: string }) {
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
          .with_asset_and_min_required_coin_by_utxo_cost(royaltyAsset, dataCost())
          .build()
      );

      txBuilder.set_mint_builder(mintBuilder);
      const royalty = royaltyMetadata(percent, address);
      txBuilder.add_json_metadatum_with_schema(BigNum.from_str(ROYALTY_LABEL), JSON.stringify(royalty), MetadataJsonSchema.NoConversions);
      if (collection?.name.trim()) {
        const registration = policyRegistration({ ...collection, policyId: script.hash().to_hex(), scriptCbor: script.to_hex(), royalty, nonce: Math.floor(currentSlot()) });
        txBuilder.add_json_metadatum_with_schema(BigNum.from_str(`${REGISTRATION_LABEL}`), JSON.stringify(registration), MetadataJsonSchema.DetailedSchema);
      }
      applyPolicy(txBuilder, policy, keyHashes);
    },
    policyTxOptions(policy, keyHashes)
  );
}
