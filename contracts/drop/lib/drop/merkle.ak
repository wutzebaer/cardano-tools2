//// The list of tokens of a drop as a Merkle tree.
////
//// Leaf n is the token with number n. The tree is filled up to a power of two.
//// A leaf and an inner node are hashed with different first bytes, so an inner
//// node can never be passed off as a token.

use aiken/crypto.{blake2b_256}
use aiken/primitive/bytearray

/// The leaf of a token: its name and the hash of its metadata datum.
pub fn leaf(name: ByteArray, metadata_hash: ByteArray) -> ByteArray {
  blake2b_256(
    #"00" |> bytearray.concat(metadata_hash) |> bytearray.concat(name),
  )
}

pub fn node(left: ByteArray, right: ByteArray) -> ByteArray {
  blake2b_256(#"01" |> bytearray.concat(left) |> bytearray.concat(right))
}

/// The root that follows from a leaf at position `index` and its siblings from bottom to top.
/// Fails if the proof is shorter than the position needs, so a number picks exactly one leaf.
pub fn root_of(hash: ByteArray, index: Int, proof: List<ByteArray>) -> ByteArray {
  when proof is {
    [] -> {
      expect index == 0
      hash
    }
    [sibling, ..rest] ->
      if index % 2 == 0 {
        root_of(node(hash, sibling), index / 2, rest)
      } else {
        root_of(node(sibling, hash), index / 2, rest)
      }
  }
}
