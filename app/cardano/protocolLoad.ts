import { protocolParamsFrom, setProtocol } from "@cardano/protocol";
import { getProtocolParams } from "@cardano/protocolData";

/** The parameters change at the start of an epoch at the earliest, so they are not asked for more often than this. */
const REFRESH_MS = 10 * 60 * 1000;

let askedAt = 0;
let pending: Promise<void> | undefined;

/**
 * Makes sure the protocol parameters are the ones in force before a transaction is built. Asks the chain data API
 * at most every ten minutes. Never fails: without an answer the values known so far stay.
 */
export async function refreshProtocol() {
  if (Date.now() - askedAt < REFRESH_MS) return;
  pending ??= getProtocolParams()
    .then((answer) => {
      if (answer != null) setProtocol(protocolParamsFrom(answer));
    })
    .catch(() => undefined)
    .finally(() => {
      askedAt = Date.now();
      pending = undefined;
    });
  await pending;
}
