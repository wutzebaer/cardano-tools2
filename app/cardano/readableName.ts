/** Whether the name of a token reads as text. No imports, so that it runs anywhere, the tests included. */

/** Text a person can read: no bytes that are no text, no control characters. */
function isReadable(text: string) {
  return text.trim() !== "" && !/[\uFFFD\u0000-\u001F\u007F-\u009F]/.test(text);
}

/** A CIP-67 label in front of an asset name: `0`, four hex digits of the label, a checksum, `0`. */
const hasLabel = (nameHex: string) => nameHex.length >= 8 && nameHex[0] === "0" && nameHex[7] === "0";

/**
 * The asset name (hex) as text, undefined where its bytes are no text a person can read: contracts name tokens by a
 * hash. A CIP-67 label in front is left out.
 */
export function assetNameText(nameHex: string): string | undefined {
  try {
    const bytes = Uint8Array.from((hasLabel(nameHex) ? nameHex.slice(8) : nameHex).match(/../g) ?? [], (byte) => parseInt(byte, 16));
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return isReadable(text) ? text : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether a token has anything to show in a feed of tokens: a picture, or a name that reads as text. Contracts keep
 * their books in tokens named by a hash, without metadata; a list full of those says nothing to anybody.
 */
export function isPresentable(token: { maName: string; name?: string | null; image?: string | null }) {
  if (token.image) return true;
  // the royalty token has no name of its own and is shown as what it is
  if (!token.maName) return true;
  return assetNameText(token.maName) !== undefined && (!token.name || isReadable(token.name));
}
