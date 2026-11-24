/**
 * What the Telegram bot understands and what it reports. Pure: the worker feeds it messages and the staking state
 * of an address, the tests do the same.
 */

/** Addresses one chat can watch. */
export const MAX_SUBSCRIPTIONS_PER_CHAT = 10;

/** A mainnet stake address in bech32. It also fits into the start parameter of a Telegram link, which takes 64 characters. */
const STAKE_ADDRESS = /^stake1[02-9ac-hj-np-z]{53}$/;

export const isStakeAddress = (text: string) => STAKE_ADDRESS.test(text);

export type Command =
  | { kind: "subscribe"; stakeAddress: string }
  | { kind: "list" }
  /** Without an index everything is stopped */
  | { kind: "stop"; index?: number }
  | { kind: "help" }
  /** Names the chat, which is how the group for the pool's posts gets configured */
  | { kind: "chatid" }
  /** Sends the posts about the pool to the chat that asks, as they would look now */
  | { kind: "preview" }
  | { kind: "unknown" };

/** A message to the bot: a command, or simply a stake address to watch. */
export function parseCommand(text: string): Command {
  const [word = "", argument = ""] = text.trim().split(/\s+/);
  // in groups Telegram appends the bot's name to a command
  const command = word.toLowerCase().replace(/@\w+$/, "");
  if (command === "/start" || command === "/watch") {
    if (!argument) return { kind: "help" };
    return isStakeAddress(argument) ? { kind: "subscribe", stakeAddress: argument } : { kind: "unknown" };
  }
  if (command === "/list") return { kind: "list" };
  if (command === "/stop") {
    if (!argument || argument.toLowerCase() === "all") return { kind: "stop" };
    return /^\d+$/.test(argument) && Number(argument) >= 1 ? { kind: "stop", index: Number(argument) } : { kind: "unknown" };
  }
  if (command === "/help") return { kind: "help" };
  if (command === "/chatid") return { kind: "chatid" };
  if (command === "/preview") return { kind: "preview" };
  if (isStakeAddress(word)) return { kind: "subscribe", stakeAddress: word };
  return { kind: "unknown" };
}

export interface AlertFinding {
  level: "ok" | "info" | "warning" | "problem";
  title: string;
  text: string;
}

export interface AlertState {
  registered: boolean;
  drepId?: string | null;
  pool?: { poolHash: string; ticker?: string | null } | null;
}

export interface Alert {
  /** Stays the same for as long as the same thing is wrong, so it is reported once */
  key: string;
  title: string;
  text: string;
  /** Set for a lock that opened: it has nothing to do with the staking check the other alerts link to */
  lock?: boolean;
}

/** An output the address has locked on the timelock page, as far as the chain tells without the wallet's keys. */
export interface LockOutput {
  txHash: string;
  txIndex: number;
  /** From the metadata of the locking transaction */
  unlockSlot: number;
  lovelace: number;
  /** How many different tokens are locked along */
  tokens: number;
}

/** A row of the chain data about what an address holds: one per output and asset, ADA has no policy. */
export interface UtxoRow {
  txHash: string;
  txIndex: number;
  owningAddress: string;
  value: number;
  maPolicyId?: string | null;
}

/**
 * The locks among the outputs of a stake address: outputs at a script address made by a transaction that names
 * an unlock slot in its metadata, which is what the timelock page writes. The script itself cannot be checked
 * without the wallet's keys, a made-up lock would only earn its maker a message.
 */
export function locksOf(rows: UtxoRow[], unlockSlotOfTx: (txHash: string) => number | undefined): LockOutput[] {
  const locks = new Map<string, LockOutput>();
  for (const row of rows) {
    const unlockSlot = isScriptAddress(row.owningAddress) ? unlockSlotOfTx(row.txHash) : undefined;
    if (unlockSlot == null) continue;
    const key = `${row.txHash}#${row.txIndex}`;
    const lock = locks.get(key) ?? { txHash: row.txHash, txIndex: row.txIndex, unlockSlot, lovelace: 0, tokens: 0 };
    if (row.maPolicyId) lock.tokens += 1;
    else lock.lovelace = Number(row.value);
    locks.set(key, lock);
  }
  return [...locks.values()];
}

/**
 * Whether a payment address of a stake key belongs to a script, which is what a timelock address is. The first
 * byte of such a mainnet address is 0x11, and bech32 writes its leading five bits as "z".
 */
export const isScriptAddress = (address: string) => address.startsWith("addr1z");

const utcTime = (unix: number) => `${new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;

const ada = (lovelace: number) => `${(lovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} ₳`;

/** One alert per lock whose time is over and that has not been taken back. It ends when the output is spent. */
export function lockAlerts(locks: LockOutput[], nowSlot: number, slotZeroUnix: number, siteUrl: string): Alert[] {
  return locks
    .filter((lock) => lock.unlockSlot <= nowSlot)
    .map((lock) => ({
      key: `lock:${lock.txHash}#${lock.txIndex}`,
      title: "A timelock has opened",
      text: `${ada(lock.lovelace)}${lock.tokens > 0 ? ` and ${lock.tokens === 1 ? "a token" : `${lock.tokens} kinds of tokens`}` : ""}, locked until ${utcTime(lock.unlockSlot + slotZeroUnix)}, can be taken back now: ${siteUrl}/timelock`,
      lock: true,
    }));
}

/** What the welcome says about the locks that are still closed. */
export function pendingLocksLine(locks: LockOutput[], nowSlot: number, slotZeroUnix: number) {
  const pending = locks.filter((lock) => lock.unlockSlot > nowSlot).sort((a, b) => a.unlockSlot - b.unlockSlot);
  if (pending.length === 0) return undefined;
  return `${pending.length === 1 ? "1 timelock is" : `${pending.length} timelocks are`} still closed, the next opens ${utcTime(pending[0].unlockSlot + slotZeroUnix)}. I write when one opens.`;
}

/** Everything about the staking of an address that calls for the owner's attention right now. */
export function alertsOf(state: AlertState, findings: AlertFinding[]): Alert[] {
  if (!state.registered) {
    return [{ key: "unregistered", title: "This address is not staking", text: "Its stake key is not registered, so the ADA earns no rewards." }];
  }
  if (!state.pool) {
    return [{ key: "undelegated", title: "This address is not delegated to a pool", text: "The stake key is registered but points to no pool, so it earns no rewards." }];
  }
  const alerts: Alert[] = findings
    .filter((finding) => finding.level === "problem" || finding.level === "warning")
    // the title carries the epoch or the percentage, so a changed announcement is a new alert, and so is another pool
    .map((finding) => ({ key: `pool:${state.pool!.poolHash}:${finding.title}`, title: finding.title, text: finding.text }));
  if (!state.drepId) {
    alerts.push({
      key: "no-vote",
      title: "The choice about the voting rights is open",
      text: "Cardano only pays staking rewards out once the stake key has delegated its vote or chosen not to take part. Until then rewards add up but cannot be withdrawn.",
    });
  }
  return alerts;
}

/** The alerts that were not there at the last look. */
export const newAlerts = (knownKeys: string[], current: Alert[]) => current.filter((alert) => !knownKeys.includes(alert.key));

const shorten = (stakeAddress: string) => `${stakeAddress.slice(0, 12)}…${stakeAddress.slice(-6)}`;

const checkUrl = (siteUrl: string, stakeAddress: string) => `${siteUrl}/check/${stakeAddress}`;

const poolName = (state: AlertState) => (state.pool?.ticker ? `[${state.pool.ticker}]` : "a pool without a name");

/** The answer to a new subscription: what is watched and how things stand. */
export function welcomeMessage(stakeAddress: string, state: AlertState, alerts: Alert[], siteUrl: string, pendingLocks?: string) {
  const lines = [`Watching ${shorten(stakeAddress)}${state.registered && state.pool ? `, staked with ${poolName(state)}` : ""}.`, ""];
  if (alerts.length === 0) {
    lines.push("Nothing stands out right now.");
  } else {
    lines.push("Right now:");
    for (const alert of alerts) lines.push(`• ${alert.title}`);
  }
  if (pendingLocks) lines.push("", pendingLocks);
  lines.push(
    "",
    "I look once an hour and write when the pool announces its retirement, gets oversaturated, raises its fees or stops making blocks, when the choice about the voting rights is missing, and when a timelock of this address opens.",
    "",
    `Details: ${checkUrl(siteUrl, stakeAddress)}`,
    "/list shows what I watch, /stop ends it."
  );
  return lines.join("\n");
}

/** One message for everything that is new about an address. */
export function alertMessage(stakeAddress: string, alerts: Alert[], siteUrl: string) {
  const lines = [`News for ${shorten(stakeAddress)}:`];
  for (const alert of alerts) lines.push("", alert.title, alert.text);
  // a lock that opened carries its own link, the staking check has nothing to add to it
  if (alerts.some((alert) => !alert.lock)) lines.push("", `Details and other pools: ${checkUrl(siteUrl, stakeAddress)}`);
  return lines.join("\n");
}

/** How things stand for one watched address, in a line for the list. */
export function watchSummary(state: AlertState, alerts: Alert[], locks: LockOutput[], nowSlot: number, slotZeroUnix: number) {
  const staking = !state.registered ? "not staking" : state.pool ? `staked with ${poolName(state)}` : "not delegated to a pool";
  const open = alerts.filter((alert) => !alert.lock && alert.key !== "unregistered" && alert.key !== "undelegated").map((alert) => alert.title);
  const closed = locks.filter((lock) => lock.unlockSlot > nowSlot).sort((a, b) => a.unlockSlot - b.unlockSlot);
  const opened = locks.length - closed.length;
  const parts = [staking, ...open];
  if (opened > 0) parts.push(`${opened === 1 ? "1 timelock" : `${opened} timelocks`} can be taken back`);
  if (closed.length > 0) parts.push(`${closed.length === 1 ? "1 timelock" : `${closed.length} timelocks`} closed, the next opens ${utcTime(closed[0].unlockSlot + slotZeroUnix)}`);
  if (locks.length === 0) parts.push("no timelocks");
  return parts.join(", ");
}

export const WATCHED_FOR =
  "For each I write when its pool retires, stops making blocks, raises its fees or gets oversaturated, when the choice about the voting rights is missing, and when a timelock opens.";

/** What the chat has the bot watch. A summary is missing for an address the chain data could not be read for. */
export function listMessage(watched: { stakeAddress: string; summary?: string }[]) {
  if (watched.length === 0) return "I am not watching any address for you. Send me a stake address (stake1…) or use the button on the staking check.";
  return [
    "I am watching:",
    ...watched.flatMap((entry, index) => ["", `${index + 1}. ${entry.stakeAddress}`, ...(entry.summary ? [`Now: ${entry.summary}`] : [])]),
    "",
    WATCHED_FOR,
    "",
    "/stop 1 ends the first, /stop ends all.",
  ].join("\n");
}

export const HELP_MESSAGE = [
  "I watch the staking of Cardano addresses and write when something needs your attention: the pool retires, gets oversaturated, raises its fees or stops making blocks, or the choice about the voting rights is missing. I also write when something you locked on https://cardano-tools.io/timelock can be taken back.",
  "",
  "Send me a stake address (stake1…) to start, or use the button on https://cardano-tools.io/check.",
  "/list shows what I watch, /stop ends it.",
  "",
  "I store your chat id and the addresses you ask me to watch, nothing else.",
].join("\n");
