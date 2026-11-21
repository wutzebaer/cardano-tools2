import { getStakeInfo } from "@cardano/dbsync";
import { PolicyPrivate, SimpleScript, WalletConnection } from "@cardano/types";
import {
  Address,
  BigNum,
  Certificate,
  Certificates,
  CoinSelectionStrategyCIP2,
  Ed25519KeyHash,
  FixedTransaction,
  LinearFee,
  NativeScript,
  NativeScripts,
  PrivateKey,
  RewardAddress,
  ScriptAll,
  ScriptAny,
  ScriptPubkey,
  StakeDelegation,
  StakeRegistrationAndDelegation,
  TimelockExpiry,
  TimelockStart,
  Transaction,
  TransactionBuilder,
  TransactionBuilderConfigBuilder,
  TransactionOutput,
  TransactionUnspentOutput,
  TransactionUnspentOutputs,
  TransactionWitnessSet,
  Value,
  make_vkey_witness,
} from "@emurgo/cardano-serialization-lib-browser";

export const unixToSlot = (unixSeconds: number) => unixSeconds - 1591566291;

export const currentSlot = () => Math.floor(unixToSlot(Date.now() / 1000));

const KEY_DEPOSIT = BigNum.from_str("2000000");

export const COINS_PER_UTXO_BYTE = BigNum.from_str("4310");

const txBuilderConfig = TransactionBuilderConfigBuilder.new()
  .fee_algo(LinearFee.new(BigNum.from_str("44"), BigNum.from_str("155381")))
  .coins_per_utxo_byte(COINS_PER_UTXO_BYTE)
  .pool_deposit(BigNum.from_str("500000000"))
  .key_deposit(KEY_DEPOSIT)
  .max_value_size(5000)
  .max_tx_size(16384)
  .build();

export const sendTransaction = async (connection: WalletConnection, addOutputs: (txBuilder: TransactionBuilder) => void, policy?: PolicyPrivate) => {
  const tx = await buildTransaction(connection, addOutputs);
  return signAndSubmitTransaction(connection, tx, policy);
};

export const sendAda = async (connection: WalletConnection, targetAddress: Address, amount: BigNum) => {
  const output = TransactionOutput.new(targetAddress, Value.new(amount));
  const tx = await buildTransaction(connection, (txBuilder: TransactionBuilder) => {
    txBuilder.add_output(output);
  });
  return await signAndSubmitTransaction(connection, tx);
};

export const delegateToPool = async (connection: WalletConnection, poolId: string) => {
  const poolKeyHash = Ed25519KeyHash.from_bech32(poolId);

  const rewardAddressHash = (await connection.getRewardAddresses())[0];
  const stakeAddress = rewardAddressHashToBech32(rewardAddressHash);
  const address = Address.from_bytes(Buffer.from(rewardAddressHash, "hex"));
  const rewardAddress = RewardAddress.from_address(address)!;
  const stakeCredential = rewardAddress.payment_cred();

  let registered = false;
  try {
    registered = Boolean((await getStakeInfo(stakeAddress)).poolHash);
  } catch {
    registered = false;
  }

  const certificates = Certificates.new();
  if (registered) {
    certificates.add(Certificate.new_stake_delegation(StakeDelegation.new(stakeCredential, poolKeyHash)));
  } else {
    certificates.add(
      Certificate.new_stake_registration_and_delegation(StakeRegistrationAndDelegation.new(stakeCredential, poolKeyHash, KEY_DEPOSIT))
    );
  }

  await sendTransaction(connection, (txBuilder) => {
    txBuilder.set_certs(certificates);
  });
};

const buildTransaction = async (connection: WalletConnection, addOutputs: (txBuilder: TransactionBuilder) => void): Promise<Transaction> => {
  const changeAddress = Address.from_bytes(Buffer.from(await connection.getChangeAddress(), "hex"));

  // keep one utxo as collateral
  // const collateral = (connection.getCollateral && (await connection.getCollateral().catch(() => []))?.slice(0, 1)) ?? [];
  const collateral: string[] = [];

  // get all utxos, except collateral
  const rawUtxos = (await connection.getUtxos()).filter((item) => !collateral.includes(item));

  // parse utxos
  const utxos = rawUtxos.map((ru) => {
    return TransactionUnspentOutput.from_bytes(Buffer.from(ru, "hex"));
  });

  // create transaction unspent outputs
  const transactionUnspentOutputs = TransactionUnspentOutputs.new();
  for (const utxo of utxos) {
    transactionUnspentOutputs.add(utxo);
  }

  const txBuilder = TransactionBuilder.new(txBuilderConfig);
  txBuilder.set_ttl(currentSlot() + 60 * 10);

  // add output
  addOutputs(txBuilder);

  // add inputs
  txBuilder.add_inputs_from(transactionUnspentOutputs, CoinSelectionStrategyCIP2.RandomImproveMultiAsset);

  // add change
  txBuilder.add_change_if_needed(changeAddress);

  const tx = txBuilder.build_tx();
  console.log("built tx", tx.to_json());
  return tx;
};

const signAndSubmitTransaction = async (connection: WalletConnection, tx: Transaction, policy?: PolicyPrivate) => {
  const witnessCbor = await connection.signTx(tx.to_hex(), true);
  const witnessSet = TransactionWitnessSet.from_hex(witnessCbor);

  // keep the mint scripts the builder put into the witness set; wallets only return their vkeys
  const builtNativeScripts = tx.witness_set().native_scripts();
  if (builtNativeScripts) {
    witnessSet.set_native_scripts(builtNativeScripts);
  }

  const fixedTransaction = FixedTransaction.from_bytes(tx.to_bytes());
  const txHash = fixedTransaction.transaction_hash();

  if (policy) {
    const pkeyCbor = JSON.parse(policy.address.skey).cborHex;
    const privateKey = PrivateKey.from_hex(pkeyCbor.substring(4)); // Remove the "5820" prefix
    const witness = make_vkey_witness(txHash, privateKey);
    const vkeys = witnessSet.vkeys()!;
    vkeys.add(witness);
    witnessSet.set_vkeys(vkeys);

    const nativeScripts = NativeScripts.new();
    nativeScripts.add(toNativeScript(JSON.parse(policy.policy)));
    witnessSet.set_native_scripts(nativeScripts);
  }

  tx = Transaction.new(tx.body(), witnessSet, tx.auxiliary_data());

  console.log("signed tx", tx.to_json());
  try {
    await connection.submitTx(tx.to_hex());
  } catch (error) {
    console.error("failed to submit tx", error);
    console.log("failed to submit tx, submitting signed tx");
    // await submitSignedTx(tx.to_hex());
  }

  return txHash.to_hex();
};

export const toNativeScript = (simpleScript: SimpleScript): NativeScript => {
  if (simpleScript.type === "all") {
    const scripts = NativeScripts.new();
    simpleScript.scripts
      ?.map((s) => toNativeScript(s))
      .forEach((s) => {
        scripts.add(s);
      });
    return NativeScript.new_script_all(ScriptAll.new(scripts));
  } else if (simpleScript.type === "any") {
    const scripts = NativeScripts.new();
    simpleScript.scripts
      ?.map((s) => toNativeScript(s))
      .forEach((s) => {
        scripts.add(s);
      });
    return NativeScript.new_script_any(ScriptAny.new(scripts));
  } else if (simpleScript.type === "before") {
    return NativeScript.new_timelock_expiry(TimelockExpiry.new(simpleScript.slot!));
  } else if (simpleScript.type === "after") {
    return NativeScript.new_timelock_start(TimelockStart.new_timelockstart(BigNum.from_str(`${simpleScript.slot}`)));
  } else if (simpleScript.type === "sig") {
    return NativeScript.new_script_pubkey(ScriptPubkey.new(Ed25519KeyHash.from_bytes(Buffer.from(`${simpleScript.keyHash}`, "hex"))));
  } else {
    throw new Error(`Cannot parse ${simpleScript}`);
  }
};

export function rewardAddressHashToBech32(rewardAddressHash?: string) {
  if (!rewardAddressHash) return "";
  return Address.from_bytes(Buffer.from(rewardAddressHash, "hex")).to_bech32();
}
