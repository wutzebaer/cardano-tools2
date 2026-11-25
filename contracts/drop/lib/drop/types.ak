use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address}
use cardano/transaction.{OutputReference}

/// What a drop sells. Written once when the drop is created, the same in every group.
pub type Config {
  /// Merkle root over all tokens of the drop, see `drop/merkle`.
  root: ByteArray,
  /// How many tokens the drop has. Token numbers run from 0 to total - 1.
  total: Int,
  /// How many groups share the drop. Token n belongs to group n % groups.
  groups: Int,
  /// Price of one token in lovelace.
  price: Int,
  /// Who receives the price.
  seller: Address,
  /// Who may close the drop and take the deposits back.
  owner: VerificationKeyHash,
  /// The two parameters of the script, so the script can be rebuilt from what is on the chain.
  seed: OutputReference,
  burnable: Bool,
  /// Where the list of tokens is published, e.g. `ipfs://...`. The contract does not read it, `root` vouches for its content.
  list: ByteArray,
}

/// State of one group. It lives at the script address next to the marker token of the group.
pub type Group {
  config: Config,
  group: Int,
  /// One bit per token of the group, set once the token is sold.
  /// Token n has bit n / groups, counted from the first bit of the first byte.
  sold: ByteArray,
}

pub type MintAction {
  /// Creates the drop: mints one marker per group and nothing else.
  Create { config: Config }
  /// Everything else is decided by the output of the script that is spent in the same transaction.
  WithOutput
  /// Burns tokens the sender holds. Only in a drop that allows it.
  Burn
}

pub type SpendAction {
  /// Sells token `index`. `proof` shows that `name` and the metadata belong to the drop.
  Buy { index: Int, name: ByteArray, proof: List<ByteArray> }
  /// Ends the group. Only the owner can do this.
  Close
  /// Takes the metadata of a token back out, together with burning the token. Only in a drop that allows it.
  Reclaim
}
