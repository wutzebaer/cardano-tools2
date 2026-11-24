/**
 * The Telegram bot of the site: takes subscriptions and looks at the subscribed addresses once an hour.
 * Runs inside the one server process, started by instrumentation.ts when TELEGRAM_BOT_TOKEN is set.
 * Subscriptions live in a JSON file: a chat id, a stake address and the alerts already reported for it.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { poolFindings, PoolFacts, PoolResults } from "../check/checkLogic";
import { currentEpoch, currentSlot, NETWORK, slotToUnix, unixToEpoch } from "../cardano/network";
import { POOL_ID, POOL_TICKER } from "../cardano/pool";
import { duePoolPosts, initialPoolPostState, planCaption, PoolEpochFacts, PoolPostKind, PoolPostState, resultCaption, scheduledBlocks } from "./poolPosts";
import { unlockSlotsFromMetadata } from "../cardano/timelockScript";
import {
  Alert,
  alertMessage,
  alertsOf,
  AlertState,
  HELP_MESSAGE,
  isScriptAddress,
  listMessage,
  lockAlerts,
  LockOutput,
  locksOf,
  MAX_SUBSCRIPTIONS_PER_CHAT,
  newAlerts,
  parseCommand,
  pendingLocksLine,
  UtxoRow,
  watchSummary,
  welcomeMessage,
} from "./alertLogic";

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
  /** Which epochs the group has been told about, missing until the first look */
  poolPosts?: PoolPostState;
}

interface StakeCheck extends AlertState {
  currentEpoch: number;
  pool?: PoolFacts | null;
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://cardano-tools.io").replace(/\/$/, "");
const STORE_FILE = path.join(process.env.ALERTS_DIR || "/data", "alerts.json");
const CHECK_EVERY_MS = 60 * 60 * 1000;
const FIRST_CHECK_AFTER_MS = 2 * 60 * 1000;
const LOCK_CHECK_EVERY_MS = 60 * 1000;
const RETRY_LOCK_AFTER_SECONDS = 5 * 60;
const POOL_NEWS_EVERY_MS = 5 * 60 * 1000;
/** The one chat the posts about the pool go to. Fixed here and not by a command, so nobody can point the bot at another group. */
const POOL_CHAT_ID = Number(process.env.TELEGRAM_POOL_CHAT_ID) || undefined;
const PUSHGATEWAY_URL = (process.env.PUSHGATEWAY_URL || "http://prometheus-pushgateway:9091").replace(/\/$/, "");
const OWN_URL = `http://127.0.0.1:${process.env.PORT || 3000}`;
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
    store = { offset: Number(parsed.offset) || 0, subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [], poolPosts: parsed.poolPosts };
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

/** A picture with a text under it. Bots send files as a form, not as JSON. */
async function sendPhoto(chatId: number, image: Blob, caption: string) {
  const form = new FormData();
  form.append("chat_id", `${chatId}`);
  form.append("caption", caption);
  form.append("photo", image, "pool.png");
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: form, signal: AbortSignal.timeout(60_000), cache: "no-store" });
  } catch {
    throw new TelegramError(0, "sendPhoto: no connection to Telegram");
  }
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!response.ok || !payload?.ok) throw new TelegramError(response.status, `sendPhoto: ${payload?.description ?? response.status}`);
}

/** Scheduled blocks per epoch from the leaderlog job. Empty when the Pushgateway cannot be reached. */
async function scheduledByEpoch(): Promise<Map<number, number>> {
  try {
    const response = await fetch(`${PUSHGATEWAY_URL}/metrics`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    return response.ok ? scheduledBlocks(await response.text()) : new Map();
  } catch {
    return new Map();
  }
}

/** Picture and text of a post about the pool, null when there is nothing to say about the epoch yet. */
async function poolPost(kind: PoolPostKind, epoch: number, scheduled: Map<number, number>): Promise<{ image: Blob; caption: string } | null> {
  const count = scheduled.get(epoch);
  if (kind === "plan" && count == null) return null;
  const facts = await api<PoolEpochFacts>(`/pool/${POOL_ID}/epoch/${epoch}`);
  if (!facts) return null;
  // the page draws the picture, the bot runs in the same process and asks it directly
  const picture = await fetch(`${OWN_URL}/pool-post/${kind}/${epoch}${count != null ? `?scheduled=${count}` : ""}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!picture.ok) throw new Error(`picture of the post: ${picture.status}`);
  const caption = kind === "plan" ? planCaption(POOL_TICKER, facts, count!, SITE_URL) : resultCaption(POOL_TICKER, facts, count, SITE_URL);
  return { image: await picture.blob(), caption };
}

/** Posts what is due about the pool to its group. Without a configured group nothing is posted anywhere. */
async function postPoolNews() {
  if (!POOL_CHAT_ID) return;
  const now = currentEpoch();
  store.poolPosts ??= initialPoolPostState(now);
  const tip = await api<number>("/tip");
  if (tip == null) return;
  const scheduled = await scheduledByEpoch();
  for (const due of duePoolPosts(store.poolPosts, now, unixToEpoch(slotToUnix(tip)), scheduled)) {
    if (due.post) {
      const post = await poolPost(due.kind, due.epoch, scheduled);
      if (!post) continue;
      await sendPhoto(POOL_CHAT_ID, post.image, post.caption);
      log(`posted the ${due.kind} of epoch ${due.epoch}`);
    }
    // ticked off after it is out: a post that fails is tried again, the group rather sees it late than never
    store.poolPosts[due.kind] = due.epoch;
    await saveStore();
  }
}

async function apiText(route: string): Promise<string> {
  const response = await fetch(`${process.env.CARDANO_DBSYNC_API_URL}${route}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`chain data: ${response.status}`);
  return response.text();
}

async function api<T>(route: string): Promise<T | null> {
  const text = await apiText(route);
  // the API answers an unknown address or pool with an empty body
  return text ? (JSON.parse(text) as T) : null;
}

/** Unlock slot a transaction names in its metadata, null if it names none. A transaction never changes, so it is asked once. */
const unlockSlots = new Map<string, number | null>();
const MAX_REMEMBERED_TRANSACTIONS = 20_000;

/** What the address has locked on the timelock page. */
async function locksOfAddress(stakeAddress: string): Promise<LockOutput[]> {
  const rows = ((await api<UtxoRow[]>(`/${stakeAddress}/utxos`)) ?? []).filter((row) => isScriptAddress(row.owningAddress));
  for (const txHash of new Set(rows.map((row) => row.txHash))) {
    if (unlockSlots.has(txHash)) continue;
    if (unlockSlots.size >= MAX_REMEMBERED_TRANSACTIONS) unlockSlots.clear();
    // a failed lookup ends the look at this address for now: guessing "no lock" would report the lock again later
    const slots = unlockSlotsFromMetadata(await apiText(`/transaction/${txHash}/metadata`));
    // one transaction makes one lock; should it ever name several slots, the message comes when all of them are over
    unlockSlots.set(txHash, slots.length > 0 ? Math.max(...slots) : null);
  }
  return locksOf(rows, (txHash) => unlockSlots.get(txHash) ?? undefined);
}

/** The staking state of an address and what stands out about it, by the rules of the staking check, and its timelocks. */
async function look(stakeAddress: string): Promise<{ state: AlertState; alerts: Alert[]; locks: LockOutput[] }> {
  const locks = await locksOfAddress(stakeAddress);
  const opened = lockAlerts(locks, currentSlot(), NETWORK.slotZeroUnix, SITE_URL);
  const check = await api<StakeCheck>(`/${stakeAddress}/stakeCheck`);
  if (!check) return { state: { registered: false }, alerts: [...alertsOf({ registered: false }, []), ...opened], locks };
  const results = check.pool ? await api<PoolResults>(`/pool/${check.pool.poolHash}/performance`) : null;
  const findings = check.pool ? poolFindings(check.pool, results, check.currentEpoch) : [];
  return { state: check, alerts: [...alertsOf(check, findings), ...opened], locks };
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
    const { state, alerts, locks } = await look(command.stakeAddress);
    const known = alerts.map((alert) => alert.key);
    const subscription = existing ?? { chatId, stakeAddress: command.stakeAddress, alerts: known, since: new Date().toISOString() };
    subscription.alerts = known;
    if (!existing) store.subscriptions.push(subscription);
    rememberNextUnlock(subscription, locks);
    await saveStore();
    await send(chatId, welcomeMessage(command.stakeAddress, state, alerts, SITE_URL, pendingLocksLine(locks, currentSlot(), NETWORK.slotZeroUnix)));
  } else if (command.kind === "list") {
    const watched = [];
    for (const { stakeAddress } of mine()) {
      // the list is still worth showing when the chain data of an address cannot be read right now
      const summary = await look(stakeAddress).then(
        ({ state, alerts, locks }) => watchSummary(state, alerts, locks, currentSlot(), NETWORK.slotZeroUnix),
        () => undefined
      );
      watched.push({ stakeAddress, summary });
    }
    await send(chatId, listMessage(watched));
  } else if (command.kind === "stop") {
    const watched = mine();
    const stopped = command.index == null ? watched : watched.slice(command.index - 1, command.index);
    store.subscriptions = store.subscriptions.filter((subscription) => !stopped.includes(subscription));
    await saveStore();
    await send(chatId, stopped.length === 0 ? "There was nothing to stop. /list shows what I watch." : `Stopped watching ${stopped.length === 1 ? stopped[0].stakeAddress : `${stopped.length} addresses`}. Nothing about ${stopped.length === 1 ? "it" : "them"} is stored any more.`);
  } else if (command.kind === "help") {
    await send(chatId, HELP_MESSAGE);
  } else if (command.kind === "chatid") {
    await send(chatId, `This chat has the id ${chatId}.`);
  } else if (command.kind === "preview") {
    const scheduled = await scheduledByEpoch();
    const now = currentEpoch();
    // the newest plan there is, and the epoch that ended last
    const planned = scheduled.has(now + 1) ? now + 1 : now;
    const posts = [await poolPost("plan", planned, scheduled), await poolPost("result", now - 1, scheduled)].filter((post) => post != null);
    if (posts.length === 0) await send(chatId, "There is nothing to show right now, the numbers of the pool could not be read.");
    for (const post of posts) await sendPhoto(chatId, post.image, post.caption);
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
  let backoffMs = 30_000;
  let connected = false;
  for (;;) {
    try {
      const updates = await telegram<Update[]>("getUpdates", { offset: store.offset, timeout: POLL_SECONDS, allowed_updates: ["message"] }, (POLL_SECONDS + 15) * 1000);
      backoffMs = 30_000;
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
      // never sooner than Telegram asks for, and slower with every failure in a row: knocking on a throttled bot
      // at the earliest allowed moment again and again only keeps the throttle up
      const askedFor = error instanceof TelegramError && error.retryAfterSeconds ? (error.retryAfterSeconds + 1) * 1000 : 0;
      const wait = Math.max(askedFor, backoffMs);
      connected = false;
      log(`${error instanceof Error ? error.message : error}, next try in ${Math.round(wait / 1000)} s`);
      await sleep(wait);
      backoffMs = Math.min(backoffMs * 2, 10 * 60_000);
    }
  }
}

/** When the next lock of a subscription opens, as a slot, known from the last look at it. Gone with a restart, the first check brings it back. */
const nextUnlock = new Map<Subscription, number>();

function rememberNextUnlock(subscription: Subscription, locks: LockOutput[]) {
  const pending = locks.map((lock) => lock.unlockSlot).filter((slot) => slot > currentSlot());
  if (pending.length > 0) nextUnlock.set(subscription, Math.min(...pending));
  else nextUnlock.delete(subscription);
}

/** Looks at every subscription, or only at those with a lock that has opened since the last look. */
async function checkAll(everything: boolean) {
  const due = [...store.subscriptions].filter((subscription) => everything || (nextUnlock.get(subscription) ?? Infinity) <= currentSlot());
  if (due.length === 0) return;
  for (const subscription of due) {
    try {
      const { alerts, locks } = await look(subscription.stakeAddress);
      rememberNextUnlock(subscription, locks);
      const fresh = newAlerts(subscription.alerts, alerts);
      // remembered before sending: an alert that cannot be delivered is not repeated every hour
      subscription.alerts = alerts.map((alert) => alert.key);
      if (fresh.length > 0) {
        await saveStore();
        await send(subscription.chatId, alertMessage(subscription.stakeAddress, fresh, SITE_URL));
      }
    } catch (error) {
      log(`check of one address failed: ${error instanceof Error ? error.message : error}`);
      // an opened lock is asked for again in a few minutes, not every minute while the chain data is away
      if (nextUnlock.has(subscription)) nextUnlock.set(subscription, currentSlot() + RETRY_LOCK_AFTER_SECONDS);
    }
    await sleep(500);
  }
  await saveStore();
}

/**
 * Everything is looked at once an hour. In between a minute's tick only asks about the addresses whose lock has
 * opened in the meantime: the date of a lock is known, so its message does not have to wait for the hour.
 */
async function checkForever() {
  await sleep(FIRST_CHECK_AFTER_MS);
  let lastFullCheck = 0;
  let lastPoolNews = 0;
  for (;;) {
    const everything = Date.now() - lastFullCheck >= CHECK_EVERY_MS;
    if (everything) lastFullCheck = Date.now();
    await checkAll(everything).catch((error) => log(`check failed: ${error instanceof Error ? error.message : error}`));
    if (Date.now() - lastPoolNews >= POOL_NEWS_EVERY_MS) {
      lastPoolNews = Date.now();
      await postPoolNews().catch((error) => log(`pool post failed: ${error instanceof Error ? error.message : error}`));
    }
    await sleep(LOCK_CHECK_EVERY_MS);
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
