/**
 * The Telegram bot of the site: takes subscriptions and looks at the subscribed addresses once an hour.
 * Runs inside the one server process, started by instrumentation.ts when TELEGRAM_BOT_TOKEN is set.
 * Subscriptions live in a JSON file: a chat id, a stake address and the alerts already reported for it.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { poolFindings, PoolFacts, PoolResults } from "../check/checkLogic";
import { Alert, alertMessage, alertsOf, AlertState, HELP_MESSAGE, listMessage, MAX_SUBSCRIPTIONS_PER_CHAT, newAlerts, parseCommand, welcomeMessage } from "./alertLogic";

interface Subscription {
  chatId: number;
  stakeAddress: string;
  /** Keys of the alerts that have been reported */
  alerts: string[];
  since: string;
}

interface Store {
  /** Next Telegram update to ask for */
  offset: number;
  subscriptions: Subscription[];
}

interface StakeCheck extends AlertState {
  currentEpoch: number;
  pool?: PoolFacts | null;
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://cardano-tools.io").replace(/\/$/, "");
const STORE_FILE = path.join(process.env.ALERTS_DIR || "/data", "alerts.json");
const CHECK_EVERY_MS = 60 * 60 * 1000;
const FIRST_CHECK_AFTER_MS = 2 * 60 * 1000;
const POLL_SECONDS = 50;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const log = (message: string) => console.log(`[alerts] ${message}`);

class TelegramError extends Error {
  constructor(
    readonly status: number,
    description: string,
    readonly retryAfterSeconds?: number
  ) {
    super(description);
  }
}

let store: Store = { offset: 0, subscriptions: [] };
let saving: Promise<void> = Promise.resolve();

async function loadStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(STORE_FILE, "utf8")) as Partial<Store>;
    store = { offset: Number(parsed.offset) || 0, subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [] };
  } catch (error) {
    // no file yet is the normal first start, anything else must not be overwritten silently
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Writes are queued, and a write replaces the file in one step so a crash never leaves half of it. */
function saveStore() {
  const content = JSON.stringify(store, null, 1);
  saving = saving
    .then(async () => {
      const temporary = `${STORE_FILE}.tmp`;
      await fs.writeFile(temporary, content, "utf8");
      await fs.rename(temporary, STORE_FILE);
    })
    .catch((error) => log(`could not save subscriptions: ${error instanceof Error ? error.message : error}`));
  return saving;
}

/** Calls the bot API. The token is part of the address, so errors are reported without it. */
async function telegram<T>(method: string, body: Record<string, unknown>, timeoutMs = 20_000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    throw new TelegramError(0, `${method}: no connection to Telegram`);
  }
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string; parameters?: { retry_after?: number } } | null;
  if (!response.ok || !payload?.ok) {
    throw new TelegramError(response.status, `${method}: ${payload?.description ?? response.status}`, payload?.parameters?.retry_after);
  }
  return payload.result as T;
}

async function send(chatId: number, text: string) {
  try {
    await telegram("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
  } catch (error) {
    // the user blocked the bot or deleted the chat: nobody is left to tell
    if (error instanceof TelegramError && error.status === 403) {
      store.subscriptions = store.subscriptions.filter((subscription) => subscription.chatId !== chatId);
      await saveStore();
      return;
    }
    throw error;
  }
}

async function api<T>(route: string): Promise<T | null> {
  const response = await fetch(`${process.env.CARDANO_DBSYNC_API_URL}${route}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`chain data: ${response.status}`);
  const text = await response.text();
  // the API answers an unknown address or pool with an empty body
  return text ? (JSON.parse(text) as T) : null;
}

/** The staking state of an address and what stands out about it, by the rules of the staking check. */
async function look(stakeAddress: string): Promise<{ state: AlertState; alerts: Alert[] }> {
  const check = await api<StakeCheck>(`/${stakeAddress}/stakeCheck`);
  if (!check) return { state: { registered: false }, alerts: alertsOf({ registered: false }, []) };
  const results = check.pool ? await api<PoolResults>(`/pool/${check.pool.poolHash}/performance`) : null;
  const findings = check.pool ? poolFindings(check.pool, results, check.currentEpoch) : [];
  return { state: check, alerts: alertsOf(check, findings) };
}

async function handleMessage(chatId: number, text: string) {
  const command = parseCommand(text);
  const mine = () => store.subscriptions.filter((subscription) => subscription.chatId === chatId);

  if (command.kind === "subscribe") {
    const existing = mine().find((subscription) => subscription.stakeAddress === command.stakeAddress);
    if (!existing && mine().length >= MAX_SUBSCRIPTIONS_PER_CHAT) {
      await send(chatId, `I watch at most ${MAX_SUBSCRIPTIONS_PER_CHAT} addresses per chat. /list shows them, /stop 1 ends the first.`);
      return;
    }
    const { state, alerts } = await look(command.stakeAddress);
    const known = alerts.map((alert) => alert.key);
    if (existing) existing.alerts = known;
    else store.subscriptions.push({ chatId, stakeAddress: command.stakeAddress, alerts: known, since: new Date().toISOString() });
    await saveStore();
    await send(chatId, welcomeMessage(command.stakeAddress, state, alerts, SITE_URL));
  } else if (command.kind === "list") {
    await send(chatId, listMessage(mine().map((subscription) => subscription.stakeAddress)));
  } else if (command.kind === "stop") {
    const watched = mine();
    const stopped = command.index == null ? watched : watched.slice(command.index - 1, command.index);
    store.subscriptions = store.subscriptions.filter((subscription) => !stopped.includes(subscription));
    await saveStore();
    await send(chatId, stopped.length === 0 ? "There was nothing to stop. /list shows what I watch." : `Stopped watching ${stopped.length === 1 ? stopped[0].stakeAddress : `${stopped.length} addresses`}. Nothing about ${stopped.length === 1 ? "it" : "them"} is stored any more.`);
  } else if (command.kind === "help") {
    await send(chatId, HELP_MESSAGE);
  } else {
    await send(chatId, "I did not understand that. Send me a stake address (it starts with stake1), or /list, /stop or /help.");
  }
}

interface Update {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
}

/** Long polling: one request waits for up to POLL_SECONDS, so there is exactly one open connection to Telegram. */
async function pollForever() {
  let backoffMs = 5_000;
  let connected = false;
  for (;;) {
    try {
      const updates = await telegram<Update[]>("getUpdates", { offset: store.offset, timeout: POLL_SECONDS, allowed_updates: ["message"] }, (POLL_SECONDS + 15) * 1000);
      backoffMs = 5_000;
      if (!connected) {
        connected = true;
        log("connected to Telegram");
      }
      for (const update of updates) {
        // the update counts as handled before it is answered: a message that keeps failing must not block the rest
        store.offset = update.update_id + 1;
        if (update.message?.text) {
          await handleMessage(update.message.chat.id, update.message.text).catch((error) => log(`message not handled: ${error instanceof Error ? error.message : error}`));
        }
      }
      if (updates.length > 0) await saveStore();
    } catch (error) {
      // 409 means a second process is polling, which happens for a moment during a rollout
      const wait = error instanceof TelegramError && error.retryAfterSeconds ? (error.retryAfterSeconds + 1) * 1000 : backoffMs;
      connected = false;
      log(`${error instanceof Error ? error.message : error}, next try in ${Math.round(wait / 1000)} s`);
      await sleep(wait);
      backoffMs = Math.min(backoffMs * 2, 5 * 60_000);
    }
  }
}

async function checkAll() {
  for (const subscription of [...store.subscriptions]) {
    try {
      const { alerts } = await look(subscription.stakeAddress);
      const fresh = newAlerts(subscription.alerts, alerts);
      // remembered before sending: an alert that cannot be delivered is not repeated every hour
      subscription.alerts = alerts.map((alert) => alert.key);
      if (fresh.length > 0) {
        await saveStore();
        await send(subscription.chatId, alertMessage(subscription.stakeAddress, fresh, SITE_URL));
      }
    } catch (error) {
      log(`check of one address failed: ${error instanceof Error ? error.message : error}`);
    }
    await sleep(500);
  }
  await saveStore();
}

async function checkForever() {
  await sleep(FIRST_CHECK_AFTER_MS);
  for (;;) {
    await checkAll().catch((error) => log(`hourly check failed: ${error instanceof Error ? error.message : error}`));
    await sleep(CHECK_EVERY_MS);
  }
}

const started = globalThis as { __alertsStarted?: boolean };

export async function startAlerts() {
  if (started.__alertsStarted) return;
  started.__alertsStarted = true;
  try {
    await fs.mkdir(path.dirname(STORE_FILE), { recursive: true });
    await loadStore();
    // proves that the folder can be written before anybody subscribes
    await saveStore();
    await fs.access(STORE_FILE);
  } catch (error) {
    log(`not started, the store ${STORE_FILE} cannot be used: ${error instanceof Error ? error.message : error}`);
    return;
  }
  log(`started with ${store.subscriptions.length} subscriptions`);
  void pollForever();
  void checkForever();
}
