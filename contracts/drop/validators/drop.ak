//// An NFT drop that mints a token only when it is bought.
////
//// The seller creates the drop with one transaction: it spends `seed` and puts one
//// group per marker token at the script address. A group knows the Merkle root of
//// all tokens, the price and which of its tokens are sold.
////
//// A buyer picks a token, spends its group and mints the token in the same
//// transaction. The group goes back with the token ticked off, the price goes to
//// the seller and the metadata stays at the script address for good (CIP-68).
////
//// `seed` makes the policy id unique and lets the drop be created only once.
//// `burnable` says whether a holder may burn a token and take the deposit of its
//// metadata back. A burned token stays ticked off, it can never be bought again.
////
//// The transaction that creates the drop may also mint the royalty token of
//// CIP-27, the one token with an empty name. It is the only chance to do so, and
//// it is the first mint of the policy, as marketplaces expect.

use aiken/cbor
use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{blake2b_256}
use aiken/math
use aiken/primitive/bytearray
use cardano/address.{Script}
use cardano/assets.{PolicyId}
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, find_input,
}
use drop/merkle
use drop/types.{
  Burn, Buy, Close, Config, Create, Group, MintAction, Reclaim, SpendAction,
  WithOutput,
}

/// CIP-67 labels of CIP-68: the token that carries the metadata and the token the buyer gets.
pub const reference_label = #"000643b0"

pub const user_label = #"000de140"

/// CIP-27: the token with an empty name, whose minting transaction says what royalties the policy asks for.
pub const royalty_token = ""

/// Name of the marker token of a group. Token names start with a CIP-67 label, so they never clash.
pub fn marker(group: Int) -> ByteArray {
  bytearray.concat("grp", bytearray.from_int_big_endian(group, 2))
}

/// How many tokens belong to a group.
pub fn size_of_group(config: Config, group: Int) -> Int {
  ( config.total - group + config.groups - 1 ) / config.groups
}

/// A group in which nothing is sold yet.
pub fn fresh_group(config: Config, group: Int) -> Group {
  let bytes = ( size_of_group(config, group) + 7 ) / 8
  Group { config, group, sold: bytearray.replicate(bytes, 0) }
}

/// `sold` with the bit at `position` set.
pub fn tick(sold: ByteArray, position: Int) -> ByteArray {
  let size = bytearray.length(sold)
  let mask = bytearray.from_int_big_endian(
    math.pow2(size * 8 - 1 - position),
    size,
  )
  bytearray.or_bytes(sold, mask, False)
}

validator drop(seed: OutputReference, burnable: Bool) {
  mint(action: MintAction, policy_id: PolicyId, self: Transaction) {
    when action is {
      Create { config } -> {
        expect Some(_) = find_input(self.inputs, seed)
        expect and {
            bytearray.length(config.root) == 32,
            config.groups >= 1,
            config.groups <= 65535,
            config.total >= config.groups,
            config.price >= 0,
            config.seed == seed,
            config.burnable == burnable,
          }
        let groups = list.range(0, config.groups - 1)
        let markers = list.map(groups, fn(group) { Pair(marker(group), 1) })
        let minted = dict.to_pairs(assets.tokens(self.mint, policy_id))
        and {
          // The empty name sorts before the markers.
          or {
            minted == markers,
            minted == [Pair(royalty_token, 1), ..markers],
          },
          holds_fresh_groups(self.outputs, policy_id, config, 0),
        }
      }
      // An output of the script can only be spent under the rules below, and they say what may be minted.
      WithOutput ->
        list.any(
          self.inputs,
          fn(input) {
            input.output.address.payment_credential == Script(policy_id)
          },
        )
      Burn -> and {
          burnable,
          only_burns(dict.to_pairs(assets.tokens(self.mint, policy_id))),
        }
    }
  }

  spend(
    datum: Option<Data>,
    action: SpendAction,
    own_reference: OutputReference,
    self: Transaction,
  ) {
    expect Some(own) = find_input(self.inputs, own_reference)
    expect Script(policy_id) = own.output.address.payment_credential
    let minted = dict.to_pairs(assets.tokens(self.mint, policy_id))

    when action is {
      Reclaim -> {
        // The output holds the metadata of one token. Whoever burns that token may take it.
        expect [Pair(reference_token, _)] = dict.to_pairs(
          assets.tokens(own.output.value, policy_id),
        )
        expect bytearray.take(reference_token, 4) == reference_label
        let user_token = bytearray.concat(
          user_label,
          bytearray.drop(reference_token, 4),
        )
        and {
          burnable,
          only_burns(minted),
          assets.quantity_of(self.mint, policy_id, reference_token) == -1,
          assets.quantity_of(self.mint, policy_id, user_token) == -1,
        }
      }
      _ -> {
        expect Some(data) = datum
        expect Group { config, group, sold }: Group = data
        // Anyone can send a made-up group to the address. Only one with the marker is real.
        expect
          assets.quantity_of(own.output.value, policy_id, marker(group)) == 1
        when action is {
          Buy { index, name, proof } -> {
            let position = index / config.groups
            let reference_token = bytearray.concat(reference_label, name)
            let user_token = bytearray.concat(user_label, name)
            expect [next, metadata, payment, ..] = self.outputs
            expect InlineDatum(metadata_datum) = metadata.datum
            let metadata_hash = blake2b_256(cbor.serialise(metadata_datum))
            let next_group: Data = Group {
              config,
              group,
              sold: tick(sold, position),
            }
            and {
              index >= 0,
              index < config.total,
              index % config.groups == group,
              !bytearray.test_bit(sold, position),
              merkle.root_of(merkle.leaf(name, metadata_hash), index, proof) == config.root,
              // Exactly this one token, so two groups can never be spent in one purchase.
              minted == [Pair(reference_token, 1), Pair(user_token, 1)],
              // The group goes back unchanged except for the tick.
              next.address == own.output.address,
              next.value == own.output.value,
              next.datum == InlineDatum(next_group),
              next.reference_script == None,
              // The metadata is locked at the script address.
              metadata.address == address.from_script(policy_id),
              assets.without_lovelace(metadata.value) == assets.from_asset(
                policy_id,
                reference_token,
                1,
              ),
              metadata.reference_script == None,
              payment.address == config.seller,
              assets.lovelace_of(payment.value) >= config.price,
            }
          }
          Close -> and {
              list.has(self.extra_signatories, config.owner),
              // Markers are burned and nothing is minted, so a closed group never comes back.
              only_burns(minted),
              assets.quantity_of(self.mint, policy_id, marker(group)) == -1,
            }
          Reclaim -> False
        }
      }
    }
  }

  else(_) {
    fail
  }
}

fn only_burns(minted: Pairs<ByteArray, Int>) -> Bool {
  list.all(minted, fn(token) { token.2nd < 0 })
}

/// The first outputs are the groups of a new drop, in order, each with its marker and nothing sold.
fn holds_fresh_groups(
  outputs: List<Output>,
  policy_id: PolicyId,
  config: Config,
  group: Int,
) -> Bool {
  if group == config.groups {
    True
  } else {
    expect [output, ..rest] = outputs
    let expected: Data = fresh_group(config, group)
    and {
      output.address.payment_credential == Script(policy_id),
      assets.without_lovelace(output.value) == assets.from_asset(
        policy_id,
        marker(group),
        1,
      ),
      output.datum == InlineDatum(expected),
      output.reference_script == None,
      holds_fresh_groups(rest, policy_id, config, group + 1),
    }
  }
}

// ---------------------------------------------------------------------------
// Tests: a drop of five tokens in two groups. Group 0 has tokens 0, 2, 4 and group 1 has 1, 3.

const policy = #"11111111111111111111111111111111111111111111111111111111"

const seed_reference =
  OutputReference {
    transaction_id: #"aa00000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

const group_reference =
  OutputReference {
    transaction_id: #"bb00000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

const owner = #"22222222222222222222222222222222222222222222222222222222"

const buyer = #"33333333333333333333333333333333333333333333333333333333"

const deposit = 2_000_000

fn name_of(index: Int) -> ByteArray {
  bytearray.concat("Token", bytearray.from_int_big_endian(index, 1))
}

fn metadata_of(index: Int) -> Data {
  let metadata: Data = [name_of(index), "ipfs://image"]
  metadata
}

fn leaves() -> List<ByteArray> {
  let tokens = list.map(
    list.range(0, 4),
    fn(index) {
      merkle.leaf(
        name_of(index),
        blake2b_256(cbor.serialise(metadata_of(index))),
      )
    },
  )
  // filled up to eight leaves
  list.concat(tokens, list.repeat(bytearray.replicate(32, 0), 3))
}

fn level_up(hashes: List<ByteArray>) -> List<ByteArray> {
  when hashes is {
    [left, right, ..rest] -> [merkle.node(left, right), ..level_up(rest)]
    _ -> []
  }
}

fn root(hashes: List<ByteArray>) -> ByteArray {
  when hashes is {
    [one] -> one
    _ -> root(level_up(hashes))
  }
}

fn proof_of(hashes: List<ByteArray>, index: Int) -> List<ByteArray> {
  when hashes is {
    [_] -> []
    _ -> {
      let beside = if index % 2 == 0 {
        index + 1
      } else {
        index - 1
      }
      expect Some(sibling) = list.at(hashes, beside)
      [sibling, ..proof_of(level_up(hashes), index / 2)]
    }
  }
}

fn config() -> Config {
  Config {
    root: root(leaves()),
    total: 5,
    groups: 2,
    price: 10_000_000,
    seller: address.from_verification_key(owner),
    owner,
    seed: seed_reference,
    burnable: False,
    list: "ipfs://list",
  }
}

fn group_output(group: Group) -> Output {
  let datum: Data = group
  Output {
    address: address.from_script(policy),
    value: assets.from_lovelace(deposit)
      |> assets.add(policy, marker(group.group), 1),
    datum: InlineDatum(datum),
    reference_script: None,
  }
}

fn plain_output(to: ByteArray, lovelace: Int) -> Output {
  Output {
    address: address.from_verification_key(to),
    value: assets.from_lovelace(lovelace),
    datum: NoDatum,
    reference_script: None,
  }
}

fn creation() -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [
      Input {
        output_reference: seed_reference,
        output: plain_output(owner, 50_000_000),
      },
    ],
    outputs: [
      group_output(fresh_group(config(), 0)),
      group_output(fresh_group(config(), 1)),
      plain_output(owner, 45_000_000),
    ],
    mint: assets.from_asset(policy, marker(0), 1)
      |> assets.add(policy, marker(1), 1),
  }
}

fn metadata_output(index: Int) -> Output {
  Output {
    address: address.from_script(policy),
    value: assets.from_lovelace(1_500_000)
      |> assets.add(
          policy,
          bytearray.concat(reference_label, name_of(index)),
          1,
        ),
    datum: InlineDatum(metadata_of(index)),
    reference_script: None,
  }
}

fn tokens_of(index: Int) -> assets.Assets {
  assets.from_asset(
    policy,
    bytearray.concat(reference_label, name_of(index)),
    1,
  )
    |> assets.add(policy, bytearray.concat(user_label, name_of(index)), 1)
}

/// The purchase of token `index` out of `group`, as an honest buyer builds it.
fn purchase(group: Group, index: Int) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [
      Input { output_reference: group_reference, output: group_output(group) },
    ],
    outputs: [
      group_output(
        Group { ..group, sold: tick(group.sold, index / group.config.groups) },
      ),
      metadata_output(index),
      plain_output(owner, group.config.price),
      Output {
        ..plain_output(buyer, 1_500_000),
        value: assets.from_lovelace(1_500_000)
          |> assets.add(policy, bytearray.concat(user_label, name_of(index)), 1),
      },
    ],
    mint: tokens_of(index),
  }
}

fn as_datum(group: Group) -> Option<Data> {
  let datum: Data = group
  Some(datum)
}

fn buy(index: Int) -> SpendAction {
  Buy { index, name: name_of(index), proof: proof_of(leaves(), index) }
}

fn buys(group: Group, index: Int, self: Transaction) -> Bool {
  drop.spend(
    seed_reference,
    False,
    as_datum(group),
    buy(index),
    group_reference,
    self,
  )
}

fn with_outputs(
  self: Transaction,
  change: fn(Output, Output, Output) -> List<Output>,
) -> Transaction {
  expect [next, metadata, payment, ..rest] = self.outputs
  Transaction {
    ..self,
    outputs: list.concat(change(next, metadata, payment), rest),
  }
}

test bits_tick_from_the_first_bit() {
  and {
    tick(#"0000", 0) == #"8000",
    tick(#"0000", 7) == #"0100",
    tick(#"0000", 8) == #"0080",
    tick(#"8000", 15) == #"8001",
    bytearray.test_bit(tick(#"0000", 9), 9),
    !bytearray.test_bit(tick(#"0000", 9), 8),
  }
}

test groups_share_the_tokens() {
  and {
    size_of_group(config(), 0) == 3,
    size_of_group(config(), 1) == 2,
    fresh_group(config(), 0).sold == #"00",
  }
}

test create_mints_one_marker_per_group() {
  drop.mint(
    seed_reference,
    False,
    Create { config: config() },
    policy,
    creation(),
  )
}

test create_may_mint_the_royalty_token() {
  let self = Transaction {
    ..creation(),
    mint: assets.add(creation().mint, policy, royalty_token, 1),
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test create_mints_one_royalty_token_at_most() fail {
  let self = Transaction {
    ..creation(),
    mint: assets.add(creation().mint, policy, royalty_token, 2),
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test create_with_royalty_token_still_needs_every_marker() fail {
  let self = Transaction {
    ..creation(),
    mint: assets.from_asset(policy, royalty_token, 1)
      |> assets.add(policy, marker(0), 1),
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test buy_cannot_mint_the_royalty_token() fail {
  let group = fresh_group(config(), 0)
  let self = Transaction {
    ..purchase(group, 2),
    mint: assets.add(tokens_of(2), policy, royalty_token, 1),
  }
  buys(group, 2, self)
}

test create_names_its_seed() fail {
  let other = Config { ..config(), seed: group_reference }
  let self = Transaction {
    ..creation(),
    outputs: [
      group_output(fresh_group(other, 0)),
      group_output(fresh_group(other, 1)),
    ],
  }
  drop.mint(seed_reference, False, Create { config: other }, policy, self)
}

test create_says_whether_tokens_burn() fail {
  drop.mint(
    seed_reference,
    True,
    Create { config: config() },
    policy,
    creation(),
  )
}

test create_needs_the_seed() fail {
  let self = Transaction {
    ..creation(),
    inputs: [
      Input {
        output_reference: group_reference,
        output: plain_output(owner, 50_000_000),
      },
    ],
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test create_mints_nothing_else() fail {
  let self = Transaction {
    ..creation(),
    mint: assets.merge(creation().mint, tokens_of(0)),
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test create_cannot_keep_a_marker() fail {
  let self = Transaction {
    ..creation(),
    outputs: [
      group_output(fresh_group(config(), 0)),
      Output {
        ..group_output(fresh_group(config(), 1)),
        address: address.from_verification_key(owner),
      },
    ],
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test create_starts_with_nothing_sold() fail {
  let ticked = Group { ..fresh_group(config(), 0), sold: #"80" }
  let self = Transaction {
    ..creation(),
    outputs: [group_output(ticked), group_output(fresh_group(config(), 1))],
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test create_gives_every_group_the_same_config() fail {
  let other = Config { ..config(), price: 1 }
  let self = Transaction {
    ..creation(),
    outputs: [
      group_output(fresh_group(config(), 0)),
      group_output(fresh_group(other, 1)),
    ],
  }
  drop.mint(seed_reference, False, Create { config: config() }, policy, self)
}

test mint_needs_a_group() fail {
  let self = Transaction {
    ..purchase(fresh_group(config(), 0), 2),
    inputs: [
      Input {
        output_reference: group_reference,
        output: plain_output(buyer, 50_000_000),
      },
    ],
  }
  drop.mint(seed_reference, False, WithOutput, policy, self)
}

test buy_a_token() {
  let group = fresh_group(config(), 0)
  let self = purchase(group, 2)
  and {
    buys(group, 2, self),
    drop.mint(seed_reference, False, WithOutput, policy, self),
  }
}

test buy_every_token_of_a_group() {
  let first = fresh_group(config(), 0)
  let second = Group { ..first, sold: tick(first.sold, 0) }
  let third = Group { ..second, sold: tick(second.sold, 2) }
  and {
    buys(first, 0, purchase(first, 0)),
    buys(second, 4, purchase(second, 4)),
    buys(third, 2, purchase(third, 2)),
    tick(third.sold, 1) == #"e0",
  }
}

test buy_from_the_other_group() {
  let group = fresh_group(config(), 1)
  buys(group, 3, purchase(group, 3))
}

test buy_only_once() fail {
  let group = Group { ..fresh_group(config(), 0), sold: tick(#"00", 1) }
  buys(group, 2, purchase(group, 2))
}

test buy_only_from_the_own_group() fail {
  let group = fresh_group(config(), 0)
  buys(group, 3, purchase(group, 3))
}

test buy_only_tokens_of_the_drop() fail {
  // the tree knows token 4, but the drop sells only four tokens
  let group = fresh_group(Config { ..config(), total: 4 }, 0)
  buys(group, 4, purchase(group, 4))
}

test buy_cannot_wrap_the_number() fail {
  // 10 ends on the same bits as 2
  let group = fresh_group(Config { ..config(), total: 12 }, 0)
  let action = Buy { index: 10, name: name_of(2), proof: proof_of(leaves(), 2) }
  let honest = purchase(group, 2)
  let self = with_outputs(
    honest,
    fn(_next, metadata, payment) {
      [
        group_output(Group { ..group, sold: tick(group.sold, 5) }),
        metadata,
        payment,
      ]
    },
  )
  drop.spend(
    seed_reference,
    False,
    as_datum(group),
    action,
    group_reference,
    self,
  )
}

test buy_with_the_metadata_of_the_drop() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(next, metadata, payment) {
      [next, Output { ..metadata, datum: InlineDatum(metadata_of(4)) }, payment]
    },
  )
  buys(group, 2, self)
}

test buy_with_the_name_of_the_drop() fail {
  let group = fresh_group(config(), 0)
  let action = Buy { index: 2, name: "Other", proof: proof_of(leaves(), 2) }
  let self = Transaction {
    ..with_outputs(
      purchase(group, 2),
      fn(next, metadata, payment) {
        [
          next,
          Output {
            ..metadata,
            value: assets.from_lovelace(1_500_000)
              |> assets.add(
                  policy,
                  bytearray.concat(reference_label, "Other"),
                  1,
                ),
          },
          payment,
        ]
      },
    ),
    mint: assets.from_asset(
      policy,
      bytearray.concat(reference_label, "Other"),
      1,
    )
      |> assets.add(policy, bytearray.concat(user_label, "Other"), 1),
  }
  drop.spend(
    seed_reference,
    False,
    as_datum(group),
    action,
    group_reference,
    self,
  )
}

test buy_pays_the_price() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(next, metadata, _payment) {
      [next, metadata, plain_output(owner, 9_999_999)]
    },
  )
  buys(group, 2, self)
}

test buy_pays_the_seller() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(next, metadata, _payment) {
      [next, metadata, plain_output(buyer, 10_000_000)]
    },
  )
  buys(group, 2, self)
}

test buy_mints_one_token() fail {
  let group = fresh_group(config(), 0)
  let self = Transaction {
    ..purchase(group, 2),
    mint: assets.merge(tokens_of(2), tokens_of(4)),
  }
  buys(group, 2, self)
}

test buy_mints_one_of_each() fail {
  let group = fresh_group(config(), 0)
  let self = Transaction {
    ..purchase(group, 2),
    mint: assets.merge(tokens_of(2), tokens_of(2)),
  }
  buys(group, 2, self)
}

test buy_ticks_the_token() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(_next, metadata, payment) { [group_output(group), metadata, payment] },
  )
  buys(group, 2, self)
}

test buy_ticks_only_the_token() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(_next, metadata, payment) {
      [group_output(Group { ..group, sold: #"e0" }), metadata, payment]
    },
  )
  buys(group, 2, self)
}

test buy_keeps_the_config() fail {
  let group = fresh_group(config(), 0)
  let cheaper = Group {
    config: Config { ..config(), price: 1 },
    group: 0,
    sold: tick(#"00", 1),
  }
  let self = with_outputs(
    purchase(group, 2),
    fn(_next, metadata, payment) { [group_output(cheaper), metadata, payment] },
  )
  buys(group, 2, self)
}

test buy_leaves_the_deposit() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(next, metadata, payment) {
      [
        Output {
          ..next,
          value: assets.from_lovelace(deposit - 1)
            |> assets.add(policy, marker(0), 1),
        },
        metadata,
        payment,
      ]
    },
  )
  buys(group, 2, self)
}

test buy_leaves_the_marker() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(next, metadata, payment) {
      [
        Output { ..next, value: assets.from_lovelace(deposit) },
        metadata,
        payment,
      ]
    },
  )
  buys(group, 2, self)
}

test buy_returns_the_group_to_the_script() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(next, metadata, payment) {
      [
        Output { ..next, address: address.from_verification_key(buyer) },
        metadata,
        payment,
      ]
    },
  )
  buys(group, 2, self)
}

test buy_locks_the_metadata() fail {
  let group = fresh_group(config(), 0)
  let self = with_outputs(
    purchase(group, 2),
    fn(next, metadata, payment) {
      [
        next,
        Output { ..metadata, address: address.from_verification_key(buyer) },
        payment,
      ]
    },
  )
  buys(group, 2, self)
}

test a_group_without_marker_is_worthless() fail {
  let group = fresh_group(config(), 0)
  let honest = purchase(group, 2)
  let forged = Output {
    ..group_output(group),
    value: assets.from_lovelace(deposit),
  }
  let self = Transaction {
    ..with_outputs(
      honest,
      fn(next, metadata, payment) {
        [
          Output { ..next, value: assets.from_lovelace(deposit) },
          metadata,
          payment,
        ]
      },
    ),
    inputs: [Input { output_reference: group_reference, output: forged }],
  }
  buys(group, 2, self)
}

test a_marker_of_another_group_does_not_help() fail {
  // group 1 pretends to be group 0 to sell token 2 again
  let lying = Group { ..fresh_group(config(), 0), group: 0 }
  let held = Output {
    ..group_output(lying),
    value: assets.from_lovelace(deposit) |> assets.add(policy, marker(1), 1),
  }
  let self = Transaction {
    ..with_outputs(
      purchase(lying, 2),
      fn(next, metadata, payment) {
        [Output { ..next, value: held.value }, metadata, payment]
      },
    ),
    inputs: [Input { output_reference: group_reference, output: held }],
  }
  buys(lying, 2, self)
}

fn closing(signed_by: List<ByteArray>, mint: assets.Assets) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [
      Input {
        output_reference: group_reference,
        output: group_output(fresh_group(config(), 0)),
      },
    ],
    outputs: [plain_output(owner, deposit)],
    mint,
    extra_signatories: signed_by,
  }
}

fn closes(self: Transaction) -> Bool {
  drop.spend(
    seed_reference,
    False,
    as_datum(fresh_group(config(), 0)),
    Close,
    group_reference,
    self,
  )
}

test close_burns_the_marker() {
  let self = closing([owner], assets.from_asset(policy, marker(0), -1))
  and {
    closes(self),
    drop.mint(seed_reference, False, WithOutput, policy, self),
  }
}

test close_needs_the_owner() fail {
  closes(closing([buyer], assets.from_asset(policy, marker(0), -1)))
}

test close_cannot_keep_the_marker() fail {
  closes(closing([owner], assets.zero))
}

test close_cannot_mint() fail {
  closes(
    closing(
      [owner],
      assets.from_asset(policy, marker(0), -1) |> assets.merge(tokens_of(0)),
    ),
  )
}

test close_cannot_burn_another_marker_instead() fail {
  closes(closing([owner], assets.from_asset(policy, marker(1), -1)))
}

fn burned(index: Int) -> assets.Assets {
  assets.negate(tokens_of(index))
}

/// The holder of token 2 takes its metadata back out and burns `mint`.
fn reclaiming(mint: assets.Assets) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [
      Input { output_reference: group_reference, output: metadata_output(2) },
    ],
    outputs: [plain_output(buyer, 1_500_000)],
    mint,
  }
}

fn reclaims(burnable: Bool, self: Transaction) -> Bool {
  drop.spend(
    seed_reference,
    burnable,
    Some(metadata_of(2)),
    Reclaim,
    group_reference,
    self,
  )
}

test buy_from_a_burnable_drop() {
  let group = fresh_group(config(), 0)
  drop.spend(
    seed_reference,
    True,
    as_datum(group),
    buy(2),
    group_reference,
    purchase(group, 2),
  )
}

test reclaim_burns_the_token_and_its_metadata() {
  let self = reclaiming(burned(2))
  and {
    reclaims(True, self),
    drop.mint(seed_reference, True, Burn, policy, self),
    drop.mint(seed_reference, True, WithOutput, policy, self),
  }
}

test reclaim_only_if_the_drop_allows_it() fail {
  reclaims(False, reclaiming(burned(2)))
}

test reclaim_needs_the_token() fail {
  reclaims(
    True,
    reclaiming(
      assets.from_asset(
        policy,
        bytearray.concat(reference_label, name_of(2)),
        -1,
      ),
    ),
  )
}

test reclaim_needs_the_token_of_the_same_name() fail {
  reclaims(
    True,
    reclaiming(
      assets.from_asset(
        policy,
        bytearray.concat(reference_label, name_of(2)),
        -1,
      )
        |> assets.add(policy, bytearray.concat(user_label, name_of(4)), -1),
    ),
  )
}

test reclaim_burns_the_metadata_token() fail {
  reclaims(
    True,
    reclaiming(
      assets.from_asset(policy, bytearray.concat(user_label, name_of(2)), -1),
    ),
  )
}

test reclaim_cannot_mint() fail {
  reclaims(True, reclaiming(assets.merge(burned(2), tokens_of(0))))
}

test reclaim_cannot_open_a_group() fail {
  // the marker read as if it were a metadata token
  let pretended = bytearray.concat(user_label, bytearray.drop(marker(0), 4))
  let self = Transaction {
    ..transaction.placeholder,
    inputs: [
      Input {
        output_reference: group_reference,
        output: group_output(fresh_group(config(), 0)),
      },
    ],
    outputs: [plain_output(buyer, deposit)],
    mint: assets.from_asset(policy, marker(0), -1)
      |> assets.add(policy, pretended, -1),
  }
  drop.spend(
    seed_reference,
    True,
    as_datum(fresh_group(config(), 0)),
    Reclaim,
    group_reference,
    self,
  )
}

fn burning(mint: assets.Assets) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [
      Input {
        output_reference: group_reference,
        output: plain_output(buyer, 5_000_000),
      },
    ],
    outputs: [plain_output(buyer, 4_800_000)],
    mint,
  }
}

fn own_token() -> assets.Assets {
  assets.from_asset(policy, bytearray.concat(user_label, name_of(2)), -1)
}

test burn_the_own_token() {
  drop.mint(seed_reference, True, Burn, policy, burning(own_token()))
}

test burn_only_if_the_drop_allows_it() fail {
  drop.mint(seed_reference, False, Burn, policy, burning(own_token()))
}

test burn_cannot_mint() fail {
  drop.mint(seed_reference, True, Burn, policy, burning(tokens_of(0)))
}
