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
export function welcomeMessage(stakeAddress: string, state: AlertState, alerts: Alert[], siteUrl: string) {
  const lines = [`Watching ${shorten(stakeAddress)}${state.registered && state.pool ? `, staked with ${poolName(state)}` : ""}.`, ""];
  if (alerts.length === 0) {
    lines.push("Nothing stands out right now.");
  } else {
    lines.push("Right now:");
    for (const alert of alerts) lines.push(`• ${alert.title}`);
  }
  lines.push(
    "",
    "I look once an hour and write when the pool announces its retirement, gets oversaturated, raises its fees or stops making blocks, and when the choice about the voting rights is missing.",
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
  lines.push("", `Details and other pools: ${checkUrl(siteUrl, stakeAddress)}`);
  return lines.join("\n");
}

export function listMessage(stakeAddresses: string[]) {
  if (stakeAddresses.length === 0) return "I am not watching any address for you. Send me a stake address (stake1…) or use the button on the staking check.";
  return ["I am watching:", ...stakeAddresses.map((address, index) => `${index + 1}. ${address}`), "", "/stop 1 ends the first, /stop ends all."].join("\n");
}

export const HELP_MESSAGE = [
  "I watch the staking of Cardano addresses and write when something needs your attention: the pool retires, gets oversaturated, raises its fees or stops making blocks, or the choice about the voting rights is missing.",
  "",
  "Send me a stake address (stake1…) to start, or use the button on https://cardano-tools.io/check.",
  "/list shows what I watch, /stop ends it.",
  "",
  "I store your chat id and the addresses you ask me to watch, nothing else.",
].join("\n");
