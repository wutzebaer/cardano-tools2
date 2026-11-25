/**
 * The transactions of an NFT drop: create it, buy a token, burn one, close it. Nothing here talks to a wallet or
 * to the chain, each function takes what it needs and returns the unsigned transaction.
 */
import { DROP_CODE, DROP_TERM_BITS } from "@cardano/dropBlueprint";
import {
  type AddressParts,
  applyDropParams,
  type DropConfig,
  type DropToken,
  freshSold,
  groupDatum,
  groupOfToken,
  type GroupState,
  isSold,
  markerName,
  merkleProof,
  merkleRoot,
  merkleTree,
  metadataDatum,
  type OutputReference,
  positionOfToken,
  REDEEMER,
  REFERENCE_LABEL,
  scriptHash,
  tickSold,
  USER_LABEL,
  utf8Hex,
} from "@cardano/dropScript";
import { policyRegistration, REGISTRATION_LABEL } from "@cardano/registration";
import {
  Address,
  AssetName,
  BaseAddress,
  BigNum,
  CostModel,
  Costmdls,
  Credential,
  DataCost,
  Ed25519KeyHash,
  EnterpriseAddress,
  ExUnitPrices,
  ExUnits,
  Int,
  Language,
  LinearFee,
  MetadataJsonSchema,
  min_ada_for_output,
  MintBuilder,
  MintWitness,
  MultiAsset,
  PlutusData,
  PlutusScript,
  PlutusScriptSource,
  PlutusWitness,
  Redeemer,
  RedeemerTag,
  ScriptHash,
  Transaction,
  TransactionBuilder,
  TransactionBuilderConfigBuilder,
  TransactionHash,
  TransactionInput,
  TransactionOutput,
  TransactionUnspentOutput,
  TxInputsBuilder,
  UnitInterval,
  Value,
} from "@emurgo/cardano-serialization-lib-browser";

const big = (value: bigint | number) => BigNum.from_str(`${value}`);
const hexBytes = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

const COINS_PER_UTXO_BYTE = big(4310);

/** Like the config of the other transactions, with the prices of running a script. */
const dropTxConfig = TransactionBuilderConfigBuilder.new()
  .fee_algo(LinearFee.new(big(44), big(155381)))
  .coins_per_utxo_byte(COINS_PER_UTXO_BYTE)
  .pool_deposit(big(500000000))
  .key_deposit(big(2000000))
  .max_value_size(5000)
  .max_tx_size(16384)
  .ex_unit_prices(ExUnitPrices.new(UnitInterval.new(big(577), big(10000)), UnitInterval.new(big(721), big(10000000))))
  .ref_script_coins_per_byte(UnitInterval.new(big(15), big(1)))
  .build();

/**
 * What a script run may cost at most. The site has no way to run the contract before submitting, so these are
 * fixed: measured on the preview testnet and rounded up generously. A transaction pays for the budget it names,
 * not for what it uses, so they are not larger than needed either.
 */
export const BUDGET = {
  create: (groups: number) => ({ mem: 250_000 + 60_000 * groups, steps: 100_000_000 + 33_000_000 * groups }),
  buySpend: { mem: 500_000, steps: 250_000_000 },
  buyMint: { mem: 120_000, steps: 50_000_000 },
  burnSpend: { mem: 300_000, steps: 120_000_000 },
  burnMint: { mem: 150_000, steps: 50_000_000 },
  closeSpend: { mem: 450_000, steps: 180_000_000 },
  closeMint: { mem: 150_000, steps: 60_000_000 },
};

/** Groups closed by one transaction, so their script runs stay within what one transaction may use. */
export const GROUPS_PER_CLOSE = 16;

/** ADA put up as collateral. It is only taken if a script fails after the transaction was accepted, which the node checks before. */
const COLLATERAL_LOVELACE = 4_000_000n;

/** ADA the rest of a collateral output with tokens keeps, enough for an output with many of them. */
const RETURN_WITH_TOKENS_LOVELACE = 4_000_000n;

export interface DropTxContext {
  /** Outputs of the wallet the transaction may spend */
  utxos: TransactionUnspentOutput[];
  changeAddress: Address;
  /** The Plutus V3 cost model in force, it is part of what the transaction signs */
  costModel: number[];
  /** Last slot the transaction is valid in */
  ttlSlot: number;
}

export interface ChainToken {
  policyId: string;
  /** Asset name as hex */
  name: string;
  quantity: bigint;
}

/** An unspent output at the address of a drop. */
export interface DropOutput {
  txHash: string;
  index: number;
  lovelace: bigint;
  tokens: ChainToken[];
  /** Inline datum as CBOR hex */
  datum?: string;
}

/** The script of a drop and what follows from it. */
export interface Drop {
  seed: OutputReference;
  burnable: boolean;
  policyId: string;
  script: string;
}

export function dropOf(seed: OutputReference, burnable: boolean): Drop {
  const script = applyDropParams(DROP_CODE, DROP_TERM_BITS, seed, burnable);
  return { seed, burnable, script, policyId: scriptHash(script) };
}

export const dropAddress = (drop: Drop, networkId: number) =>
  EnterpriseAddress.new(networkId, Credential.from_scripthash(ScriptHash.from_hex(drop.policyId))).to_address();

function credentialOf(parts: { keyHash: string } | { scriptHash: string }) {
  return "keyHash" in parts ? Credential.from_keyhash(Ed25519KeyHash.from_hex(parts.keyHash)) : Credential.from_scripthash(ScriptHash.from_hex(parts.scriptHash));
}

export function addressOf(parts: AddressParts, networkId: number) {
  const payment = credentialOf(parts.payment);
  return parts.stake ? BaseAddress.new(networkId, payment, credentialOf(parts.stake)).to_address() : EnterpriseAddress.new(networkId, payment).to_address();
}

export function addressParts(address: Address): AddressParts {
  const partsOf = (credential: Credential) => {
    const keyHash = credential.to_keyhash()?.to_hex();
    return keyHash ? { keyHash } : { scriptHash: credential.to_scripthash()!.to_hex() };
  };
  const payment = address.payment_cred();
  if (!payment) throw new Error("This address cannot receive the payments of a drop");
  const stake = BaseAddress.from_address(address)?.stake_cred();
  return { payment: partsOf(payment), ...(stake ? { stake: partsOf(stake) } : {}) };
}

function valueOf(lovelace: bigint, tokens: ChainToken[]) {
  const value = Value.new(big(lovelace));
  if (tokens.length > 0) {
    const multiAsset = MultiAsset.new();
    for (const token of tokens) {
      multiAsset.set_asset(ScriptHash.from_hex(token.policyId), AssetName.new(hexBytes(token.name)), big(token.quantity));
    }
    value.set_multiasset(multiAsset);
  }
  return value;
}

/** An output with an inline datum that holds exactly the ADA it needs, unless more is given. */
function datumOutput(address: Address, tokens: ChainToken[], datum: string, lovelace?: bigint) {
  const output = TransactionOutput.new(address, valueOf(lovelace ?? 2_000_000n, tokens));
  output.set_plutus_data(PlutusData.from_hex(datum));
  if (lovelace === undefined) {
    const needed = BigInt(min_ada_for_output(output, DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE)).to_str());
    const exact = TransactionOutput.new(address, valueOf(needed, tokens));
    exact.set_plutus_data(PlutusData.from_hex(datum));
    return exact;
  }
  return output;
}

const inputOf = (output: OutputReference | DropOutput) => TransactionInput.new(TransactionHash.from_hex(output.txHash), output.index);
const referenceOf = (utxo: TransactionUnspentOutput): OutputReference => ({ txHash: utxo.input().transaction_id().to_hex(), index: utxo.input().index() });
const lovelaceOf = (utxo: TransactionUnspentOutput) => BigInt(utxo.output().amount().coin().to_str());
const isAdaOnly = (utxo: TransactionUnspentOutput) => !utxo.output().amount().multiasset();
const sameOutput = (a: TransactionUnspentOutput, b: TransactionUnspentOutput) =>
  a.input().index() === b.input().index() && a.input().transaction_id().to_hex() === b.input().transaction_id().to_hex();

function redeemer(tag: RedeemerTag, data: string, budget: { mem: number; steps: number }) {
  // the builder numbers the redeemers itself once the inputs are final
  return Redeemer.new(tag, big(0), PlutusData.from_hex(data), ExUnits.new(big(budget.mem), big(budget.steps)));
}

function costModels(costModel: number[]) {
  const model = CostModel.new();
  costModel.forEach((cost, operation) => model.set(operation, cost < 0 ? Int.new_negative(big(-cost)) : Int.new(big(cost))));
  const models = Costmdls.new();
  models.insert(Language.new_plutus_v3(), model);
  return models;
}

function plutusScript(drop: Drop) {
  const script = PlutusScript.new_v3(hexBytes(drop.script));
  if (script.hash().to_hex() !== drop.policyId) throw new Error("The script of this drop does not match its policy id");
  return script;
}

/**
 * The output put up as collateral. One with only ADA is taken first, the smallest that is enough. Without one, any
 * output with enough ADA serves: its tokens and the rest of its ADA come straight back in the collateral return,
 * so nobody has to prepare their wallet for a purchase.
 */
function collateralOf(utxos: TransactionUnspentOutput[]) {
  const smallestFirst = (a: TransactionUnspentOutput, b: TransactionUnspentOutput) => (lovelaceOf(a) < lovelaceOf(b) ? -1 : 1);
  const pure = utxos.filter((utxo) => isAdaOnly(utxo) && lovelaceOf(utxo) >= COLLATERAL_LOVELACE).sort(smallestFirst)[0];
  if (pure) return pure;
  // the return output carries the tokens, which takes more ADA than a plain one
  const mixed = utxos.filter((utxo) => lovelaceOf(utxo) >= COLLATERAL_LOVELACE + RETURN_WITH_TOKENS_LOVELACE).sort(smallestFirst)[0];
  if (mixed) return mixed;
  throw new Error("Your wallet holds too little ADA in one place for this purchase. It needs about 8 ADA in a single output, send yourself 10 ADA and try again.");
}

interface Parts {
  /** Outputs of the wallet that have to be spent, whatever else gets picked */
  mustSpend?: TransactionUnspentOutput[];
  configure: (txBuilder: TransactionBuilder, inputs: TxInputsBuilder) => void;
}

/**
 * Adds outputs of the wallet, the ones with the most ADA first, until the transaction balances with change.
 * The library's own selection stops as soon as the fee is covered, and what is left then goes to the fee if it is
 * too little for a change output. That can cost up to an ADA, so one more output is added in that case.
 */
function build(context: DropTxContext, parts: Parts): Transaction {
  const mustSpend = parts.mustSpend ?? [];
  const spendable = context.utxos.filter((utxo) => !mustSpend.some((must) => sameOutput(must, utxo))).sort((a, b) => (lovelaceOf(a) > lovelaceOf(b) ? -1 : 1));
  const collateral = collateralOf(context.utxos);
  let lastError: unknown;
  for (let count = 0; count <= spendable.length; count++) {
    try {
      const txBuilder = TransactionBuilder.new(dropTxConfig);
      txBuilder.set_ttl_bignum(big(context.ttlSlot));
      const inputs = TxInputsBuilder.new();
      parts.configure(txBuilder, inputs);
      for (const utxo of [...mustSpend, ...spendable.slice(0, count)]) inputs.add_regular_utxo(utxo);
      txBuilder.set_inputs(inputs);
      const collateralInputs = TxInputsBuilder.new();
      collateralInputs.add_regular_utxo(collateral);
      txBuilder.set_collateral(collateralInputs);
      // what is left of the collateral output has to be an output of its own, which needs about 1 ADA
      if (!isAdaOnly(collateral) || lovelaceOf(collateral) >= COLLATERAL_LOVELACE + 1_500_000n) {
        txBuilder.set_total_collateral_and_return(big(COLLATERAL_LOVELACE), context.changeAddress);
      }
      txBuilder.calc_script_data_hash(costModels(context.costModel));
      const hasChange = txBuilder.add_change_if_needed(context.changeAddress);
      if (!hasChange && count < spendable.length) continue;
      return txBuilder.build_tx();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("Your wallet does not hold enough ADA for this transaction");
}

export interface NewDrop {
  tokens: DropToken[];
  groups: number;
  price: bigint;
  burnable: boolean;
  /** Where the list is published, the contract only stores it */
  list: string;
  /** CIP-27 royalties as they go into the metadata of the transaction: the rate as a fraction, the address in pieces of 64 characters at most */
  royalty?: { rate: string; addr: string | string[] };
  /** What the seller says about the collection, registered on chain with CIP-88 */
  collection?: { name: string; description?: string; image?: string };
}

/** CIP-27: the royalties of a policy are in the metadata of the transaction that mints its token with an empty name. */
const ROYALTY_LABEL = 777;
const ROYALTY_TOKEN = "";

/**
 * Creates a drop: one group per marker at the script address, nothing sold. The seller and owner is the wallet.
 * The output of the wallet that is spent as seed decides the policy id.
 * With royalties the royalty token is minted along into the wallet: this is the only transaction that can, and
 * marketplaces want it to be the first mint of the policy. The same token is the proof CIP-88 asks for, so the
 * name of the collection is registered with it, with or without royalties.
 */
export function createDropTx(context: DropTxContext, networkId: number, drop: NewDrop) {
  const seedUtxo = [...context.utxos].filter(isAdaOnly).sort((a, b) => (lovelaceOf(a) > lovelaceOf(b) ? -1 : 1))[0];
  if (!seedUtxo) throw new Error("Your wallet holds no output with only ADA to start the drop from");
  const seller = addressParts(context.changeAddress);
  if (!("keyHash" in seller.payment)) throw new Error("The wallet's address is a script, it cannot own a drop");
  const created = dropOf(referenceOf(seedUtxo), drop.burnable);
  const config: DropConfig = {
    root: merkleRoot(merkleTree(drop.tokens)),
    total: drop.tokens.length,
    groups: drop.groups,
    price: drop.price,
    seller,
    owner: seller.payment.keyHash,
    seed: created.seed,
    burnable: drop.burnable,
    list: drop.list,
  };
  const address = dropAddress(created, networkId);
  const script = plutusScript(created);
  const tx = build(context, {
    mustSpend: [seedUtxo],
    configure: (txBuilder) => {
      const witness = MintWitness.new_plutus_script(PlutusScriptSource.new(script), redeemer(RedeemerTag.new_mint(), REDEEMER.create(config), BUDGET.create(drop.groups)));
      const mint = MintBuilder.new();
      for (let group = 0; group < drop.groups; group++) {
        mint.add_asset(witness, AssetName.new(hexBytes(markerName(group))), Int.new_i32(1));
        const state: GroupState = { config, group, sold: freshSold(config.total, config.groups, group) };
        txBuilder.add_output(datumOutput(address, [{ policyId: created.policyId, name: markerName(group), quantity: 1n }], groupDatum(state)));
      }
      const collection = drop.collection?.name.trim() ? drop.collection : undefined;
      if (drop.royalty || collection) {
        mint.add_asset(witness, AssetName.new(hexBytes(ROYALTY_TOKEN)), Int.new_i32(1));
        // after the groups, which the contract expects first
        const royaltyToken = [{ policyId: created.policyId, name: ROYALTY_TOKEN, quantity: 1n }];
        const needed = min_ada_for_output(TransactionOutput.new(context.changeAddress, valueOf(2_000_000n, royaltyToken)), DataCost.new_coins_per_byte(COINS_PER_UTXO_BYTE));
        txBuilder.add_output(TransactionOutput.new(context.changeAddress, valueOf(BigInt(needed.to_str()), royaltyToken)));
        if (drop.royalty) txBuilder.add_json_metadatum_with_schema(big(ROYALTY_LABEL), JSON.stringify(drop.royalty), MetadataJsonSchema.NoConversions);
        if (collection) {
          const registration = policyRegistration({ ...collection, policyId: created.policyId, royalty: drop.royalty, nonce: context.ttlSlot });
          txBuilder.add_json_metadatum_with_schema(big(REGISTRATION_LABEL), JSON.stringify(registration), MetadataJsonSchema.DetailedSchema);
        }
      }
      txBuilder.set_mint_builder(mint);
    },
  });
  return { tx, drop: created, config };
}

/** A group as it sits on the chain. */
export interface DropGroup extends GroupState {
  output: DropOutput;
}

/** Buys token `index`: the group goes back with the token ticked off, the metadata stays at the script, the price goes to the seller. */
export function buyTokenTx(context: DropTxContext, networkId: number, drop: Drop, group: DropGroup, tokens: DropToken[], index: number) {
  const { config } = group;
  if (groupOfToken(index, config.groups) !== group.group) throw new Error("This token belongs to another group");
  const position = positionOfToken(index, config.groups);
  if (isSold(group.sold, position)) throw new Error("This token is already sold");
  const token = tokens[index];
  const name = utf8Hex(token.assetName);
  const referenceToken = { policyId: drop.policyId, name: REFERENCE_LABEL + name, quantity: 1n };
  const address = dropAddress(drop, networkId);
  const script = plutusScript(drop);
  return build(context, {
    configure: (txBuilder, inputs) => {
      inputs.add_plutus_script_input(
        PlutusWitness.new_with_ref_without_datum(
          PlutusScriptSource.new(script),
          redeemer(RedeemerTag.new_spend(), REDEEMER.buy(index, token.assetName, merkleProof(merkleTree(tokens), index)), BUDGET.buySpend)
        ),
        inputOf(group.output),
        valueOf(group.output.lovelace, group.output.tokens)
      );
      const witness = MintWitness.new_plutus_script(PlutusScriptSource.new(script), redeemer(RedeemerTag.new_mint(), REDEEMER.withOutput, BUDGET.buyMint));
      const mint = MintBuilder.new();
      mint.add_asset(witness, AssetName.new(hexBytes(REFERENCE_LABEL + name)), Int.new_i32(1));
      mint.add_asset(witness, AssetName.new(hexBytes(USER_LABEL + name)), Int.new_i32(1));
      txBuilder.set_mint_builder(mint);
      // the contract reads the first three outputs in this order
      txBuilder.add_output(datumOutput(address, group.output.tokens, groupDatum({ ...group, sold: tickSold(group.sold, position) }), group.output.lovelace));
      txBuilder.add_output(datumOutput(address, [referenceToken], metadataDatum(token)));
      txBuilder.add_output(TransactionOutput.new(addressOf(config.seller, networkId), Value.new(big(config.price))));
    },
  });
}

/** The wallet's output that holds a token of the drop. */
function holderOf(context: DropTxContext, policyId: string, nameHex: string) {
  const holder = context.utxos.find((utxo) => {
    const quantity = utxo.output().amount().multiasset()?.get_asset(ScriptHash.from_hex(policyId), AssetName.new(hexBytes(nameHex)));
    return quantity !== undefined && !quantity.is_zero();
  });
  if (!holder) throw new Error("This token is not in your wallet");
  return holder;
}

/** Burns a token of the wallet together with its metadata, whose deposit comes back to the wallet. Only for a burnable drop. */
export function burnTokenTx(context: DropTxContext, drop: Drop, metadata: DropOutput, assetName: string) {
  const name = utf8Hex(assetName);
  const script = plutusScript(drop);
  return build(context, {
    mustSpend: [holderOf(context, drop.policyId, USER_LABEL + name)],
    configure: (txBuilder, inputs) => {
      inputs.add_plutus_script_input(
        PlutusWitness.new_with_ref_without_datum(PlutusScriptSource.new(script), redeemer(RedeemerTag.new_spend(), REDEEMER.reclaim, BUDGET.burnSpend)),
        inputOf(metadata),
        valueOf(metadata.lovelace, metadata.tokens)
      );
      const witness = MintWitness.new_plutus_script(PlutusScriptSource.new(script), redeemer(RedeemerTag.new_mint(), REDEEMER.burn, BUDGET.burnMint));
      const mint = MintBuilder.new();
      mint.add_asset(witness, AssetName.new(hexBytes(REFERENCE_LABEL + name)), Int.new_i32(-1));
      mint.add_asset(witness, AssetName.new(hexBytes(USER_LABEL + name)), Int.new_i32(-1));
      txBuilder.set_mint_builder(mint);
    },
  });
}

/** Closes groups: their markers are burned and their deposits return to the wallet, which has to be the owner. */
export function closeGroupsTx(context: DropTxContext, drop: Drop, groups: DropGroup[]) {
  const script = plutusScript(drop);
  return build(context, {
    configure: (txBuilder, inputs) => {
      const witness = MintWitness.new_plutus_script(PlutusScriptSource.new(script), redeemer(RedeemerTag.new_mint(), REDEEMER.withOutput, BUDGET.closeMint));
      const mint = MintBuilder.new();
      for (const group of groups) {
        inputs.add_plutus_script_input(
          PlutusWitness.new_with_ref_without_datum(PlutusScriptSource.new(script), redeemer(RedeemerTag.new_spend(), REDEEMER.close, BUDGET.closeSpend)),
          inputOf(group.output),
          valueOf(group.output.lovelace, group.output.tokens)
        );
        mint.add_asset(witness, AssetName.new(hexBytes(markerName(group.group))), Int.new_i32(-1));
      }
      txBuilder.set_mint_builder(mint);
      txBuilder.add_required_signer(Ed25519KeyHash.from_hex(groups[0].config.owner));
    },
  });
}
