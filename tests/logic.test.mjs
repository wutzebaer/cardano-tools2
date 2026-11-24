// Tests for the logic that needs neither a wallet nor the chain. Run with `npm test`.
// the reports group by local time, the expectations below are written for UTC
process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { test } from "node:test";
import { alertMessage, alertsOf, listMessage, lockAlerts, locksOf, newAlerts, parseCommand, pendingLocksLine, watchSummary, welcomeMessage } from "../app/alerts/alertLogic.ts";
import { groupFeed } from "../app/browse/groupTokens.ts";
import { distribute, NotEnoughFundsError, ONE_ADA, TIP_STAKE_ADDRESS } from "../app/cardano/distribution.ts";
import { drepKind, marginCostPerYear, pickAlternatives, poolFindings, suggestsAlternatives } from "../app/check/checkLogic.ts";
import { actionStatus, actionTitle, poolsVoteOn, sortActions, voteOfAddress, voteOfPool } from "../app/votes/governanceLogic.ts";
import { assetNameFor, tokenMetadata, tokensFromMetadata, tokensMetadata } from "../app/cardano/metadata.ts";
import { NETWORK, NETWORKS, unixToEpoch, unixToSlot } from "../app/cardano/network.ts";
import { candidateUnlockTimes, DAY_SECONDS, FIRST_UNLOCK_UNIX, MAX_LOCK_DAYS, timelockMetadata, timeScriptHash, unlockSlotsFromMetadata, unlockTimeError } from "../app/cardano/timelockScript.ts";
import { policyLockSlot } from "../app/cardano/utils.ts";
import { priceAt, statementCsv, statementLines } from "../app/statement/statement.ts";
import { isPaid, monthCsv, monthTotals, rewardCsv, rewardEntries, yearTotals } from "../app/tax/rewardReport.ts";

// ---------------------------------------------------------------------------
// Reward distribution
// ---------------------------------------------------------------------------

const staker = (name, ada) => ({ stakeAddress: `stake_${name}`, address: `addr_${name}`, amount: BigInt(ada) * ONE_ADA });
const noMinimum = () => 0n;
const sum = (values) => values.reduce((total, value) => total + value, 0n);

test("distributes all ADA proportionally, minimum output first", () => {
  const positions = distribute([staker("small", 1000), staker("big", 3000)], { lovelace: 10n * ONE_ADA, tokens: [] }, undefined, noMinimum);

  assert.deepEqual(
    positions.map((position) => position.stakeAddress),
    ["stake_big", "stake_small"]
  );
  // 1 ADA each as minimum, the remaining 8 ADA split 3:1
  assert.equal(positions[0].lovelace, 7n * ONE_ADA);
  assert.equal(positions[1].lovelace, 3n * ONE_ADA);
  assert.equal(positions[0].share, 0.75);
  assert.equal(sum(positions.map((position) => position.lovelace)), 10n * ONE_ADA);
});

test("rounding remainders are not lost", () => {
  const stakers = [staker("a", 1), staker("b", 1), staker("c", 1)];
  const funds = { lovelace: 3n * ONE_ADA + 100n, tokens: [{ policyId: "aa", name: "bb", amount: 10n }] };

  const withoutTip = distribute(stakers, funds, undefined, noMinimum);
  assert.equal(sum(withoutTip.map((position) => position.lovelace)), funds.lovelace);
  assert.equal(sum(withoutTip.map((position) => position.tokens.get("aa.bb") ?? 0n)), 10n);
  assert.equal(withoutTip[0].tokens.get("aa.bb"), 4n);

  const withTip = distribute(stakers, { ...funds, lovelace: funds.lovelace + ONE_ADA }, "addr_tip", noMinimum);
  const tip = withTip.at(-1);
  assert.equal(tip.tip, true);
  assert.equal(tip.stakeAddress, TIP_STAKE_ADDRESS);
  assert.equal(tip.address, "addr_tip");
  // 1 ADA tip plus the 1 lovelace that cannot be split three ways
  assert.equal(tip.lovelace, ONE_ADA + 1n);
  assert.equal(sum(withTip.map((position) => position.lovelace)), funds.lovelace + ONE_ADA);
});

test("token units left over by rounding go to the largest fractions", () => {
  // shares of 7 tokens: 3.5, 2.33, 1.17 -> 3, 2, 1 and the last unit to the .5
  const positions = distribute([staker("a", 3), staker("b", 2), staker("c", 1)], { lovelace: 3n * ONE_ADA, tokens: [{ policyId: "aa", name: "bb", amount: 7n }] }, undefined, noMinimum);
  assert.deepEqual(
    positions.map((position) => position.tokens.get("aa.bb")),
    [4n, 2n, 1n]
  );

  // 5 tokens for 3 equal stakers: 2, 2, 1 instead of everything extra to the first
  const equal = distribute([staker("a", 1), staker("b", 1), staker("c", 1)], { lovelace: 3n * ONE_ADA, tokens: [{ policyId: "aa", name: "bb", amount: 5n }] }, undefined, noMinimum);
  assert.deepEqual(
    equal.map((position) => position.tokens.get("aa.bb")),
    [2n, 2n, 1n]
  );
});

test("stakers with a tiny share get no dust tokens", () => {
  const positions = distribute([staker("whale", 999), staker("shrimp", 1)], { lovelace: 5n * ONE_ADA, tokens: [{ policyId: "aa", name: "", amount: 10n }] }, undefined, noMinimum);
  assert.equal(positions[0].tokens.get("aa."), 10n);
  assert.equal(positions[1].tokens.size, 0);
});

test("reports how much ADA is needed when the minimum outputs are not covered", () => {
  const minimum = (_address, tokens) => (tokens.size > 0 ? 2n * ONE_ADA : 0n);
  const stakers = [staker("a", 1), staker("b", 1)];
  const funds = { lovelace: 3n * ONE_ADA, tokens: [{ policyId: "aa", name: "bb", amount: 2n }] };
  assert.throws(
    () => distribute(stakers, funds, undefined, minimum),
    (error) => error instanceof NotEnoughFundsError && error.required === 4n * ONE_ADA
  );
});

test("nothing to distribute without stakers", () => {
  assert.deepEqual(distribute([], { lovelace: ONE_ADA, tokens: [] }, undefined, noMinimum), []);
});

// ---------------------------------------------------------------------------
// Wallet statement
// ---------------------------------------------------------------------------

test("price lookup takes the latest price at or before the time", () => {
  const prices = [
    [100, 1],
    [200, 2],
    [300, 3],
  ];
  assert.equal(priceAt(prices, 99), undefined);
  assert.equal(priceAt(prices, 100), 1);
  assert.equal(priceAt(prices, 250), 2);
  assert.equal(priceAt(prices, 5000), 3);
  assert.equal(priceAt([], 100), undefined);
});

test("statement has a running balance, fiat values and is newest first", () => {
  const rows = [
    { timestamp: "2024-01-01T00:00:00.000Z", epoch: 458, txHash: "aa", change: 10_000_000, operations: ["IN"] },
    { timestamp: "2024-01-02T00:00:00.000Z", epoch: 458, txHash: null, change: 500_000, operations: ["REWARD_member"] },
    { timestamp: "2024-01-03T00:00:00.000Z", epoch: 459, txHash: "bb", change: -4_000_000, operations: ["OUT", "IN"] },
  ];
  const prices = [[Date.parse("2024-01-02T00:00:00.000Z") / 1000, 0.5]];
  const lines = statementLines(rows, prices);

  assert.deepEqual(
    lines.map((line) => line.balance),
    [6_500_000, 10_500_000, 10_000_000]
  );
  assert.equal(lines[0].fiat, -2);
  assert.equal(lines[1].fiat, 0.25);
  assert.equal(lines[2].fiat, undefined);

  const csv = statementCsv(lines, "EUR").split("\r\n");
  assert.equal(csv[0], "Timestamp,Epoch,TxHash,Change ADA,Price EUR,Change EUR,Balance ADA,Operations");
  assert.equal(csv[1], "2024-01-03T00:00:00.000Z,459,bb,-4.000000,0.500000,-2.00,6.500000,OUT IN");
  assert.equal(csv[3], "2024-01-01T00:00:00.000Z,458,aa,10.000000,,,10.000000,IN");
});

// ---------------------------------------------------------------------------
// Mint metadata
// ---------------------------------------------------------------------------

const token = (patch = {}) => ({
  id: "1",
  standard: 222,
  assetName: "Token001",
  amount: "1",
  name: "Token 001",
  description: "",
  image: "ipfs://QmImage",
  mediaType: "image/png",
  ticker: "",
  url: "",
  decimals: "",
  files: [],
  properties: [],
  extra: {},
  ...patch,
});

test("asset names are alphanumeric and leave room for the CIP-67 label", () => {
  assert.equal(assetNameFor("My Token #1"), "MyToken1");
  assert.equal(assetNameFor("a".repeat(40)).length, 28);
});

test("token metadata contains only what is set", () => {
  assert.deepEqual(tokenMetadata(token()), { name: "Token 001", image: "ipfs://QmImage", mediaType: "image/png" });
  assert.deepEqual(tokenMetadata(token({ standard: 333, ticker: "TKN", decimals: "6", properties: [{ key: "artist", value: "me" }], extra: { traits: ["a", "b"] } })), {
    name: "Token 001",
    ticker: "TKN",
    decimals: 6,
    logo: "ipfs://QmImage",
    artist: "me",
    traits: ["a", "b"],
  });
});

test("edited metadata becomes the token list again", () => {
  const original = [
    token({ amount: "5", description: "d".repeat(100), files: [{ name: "full", mediaType: "image/png", src: "ipfs://QmFull" }], properties: [{ key: "artist", value: "me" }], extra: { traits: ["a", "b"], rank: 3 } }),
  ];
  const edited = tokensMetadata(original);
  assert.deepEqual(Object.keys(edited), ["Token001"]);
  edited.Second = { name: "Second", image: ["ipfs://", "QmSecond"] };

  const tokens = tokensFromMetadata(edited, original);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].id, "1");
  assert.equal(tokens[0].amount, "5");
  assert.deepEqual(tokens[0].properties, [{ key: "artist", value: "me" }]);
  assert.deepEqual(tokens[0].extra, { traits: ["a", "b"], rank: 3 });
  assert.deepEqual(tokenMetadata(tokens[0]), tokenMetadata(original[0]));
  assert.equal(tokens[1].assetName, "Second");
  assert.equal(tokens[1].image, "ipfs://QmSecond");
  assert.equal(tokens[1].amount, "1");

  assert.throws(() => tokensFromMetadata([], []), /object/);
  assert.throws(() => tokensFromMetadata({ ["x".repeat(29)]: { name: "x" } }, []), /bytes/);
});

test("a policy locks at the last slot its script can still validate", () => {
  const sig = { type: "sig", keyHash: "aa" };
  const before = (slot) => ({ type: "before", slot });
  const lock = (script) => policyLockSlot(JSON.stringify(script));

  // all: the first time lock ends it
  assert.equal(lock({ type: "all", scripts: [sig, before(500)] }), 500);
  assert.equal(lock({ type: "all", scripts: [sig, before(500), before(300)] }), 300);
  assert.equal(lock({ type: "all", scripts: [sig, before(500), { type: "any", scripts: [before(300)] }] }), 300);
  assert.equal(lock(before(700)), 700);

  // any: a branch without time lock keeps it open, otherwise the last one ends it
  assert.equal(lock({ type: "any", scripts: [sig, before(500)] }), undefined);
  assert.equal(lock({ type: "any", scripts: [before(300), before(500)] }), 500);

  // atLeast: open as long as enough branches are
  assert.equal(lock({ type: "atLeast", required: 1, scripts: [sig, before(500)] }), undefined);
  assert.equal(lock({ type: "atLeast", required: 2, scripts: [sig, before(500)] }), 500);
  assert.equal(lock({ type: "atLeast", required: 2, scripts: [before(100), before(300), before(500)] }), 300);
  assert.equal(lock({ type: "atLeast", required: 2, scripts: [sig, sig, before(500)] }), undefined);

  // nested
  assert.equal(lock({ type: "all", scripts: [sig, { type: "any", scripts: [sig, before(300)] }] }), undefined);
  assert.equal(lock({ type: "all", scripts: [before(900), { type: "any", scripts: [sig, before(300)] }] }), 900);
  assert.equal(lock({ type: "any", scripts: [{ type: "all", scripts: [sig, before(300)] }, { type: "all", scripts: [sig, before(800)] }] }), 800);

  // "after" opens a script, it never locks one
  assert.equal(lock({ type: "all", scripts: [sig, { type: "after", slot: 100 }] }), undefined);

  assert.equal(lock(sig), undefined);
  assert.equal(policyLockSlot(null), undefined);
  assert.equal(policyLockSlot("not json"), undefined);
});

// ---------------------------------------------------------------------------
// Networks
// ---------------------------------------------------------------------------

test("slots and epochs match the chains", () => {
  const network = (name) => NETWORKS[name];
  // preview node tip on 2026-11-22T10:36:45Z: epoch 1489, slot 128687805
  const now = Date.parse("2026-11-22T10:36:45Z") / 1000;
  assert.equal(unixToSlot(now, network("preview")), 128687805);
  assert.equal(unixToEpoch(now, network("preview")), 1489);
  // the same moment was epoch 327 on preprod and 669 on mainnet
  assert.equal(unixToEpoch(now, network("preprod")), 327);
  assert.equal(unixToEpoch(now, network("mainnet")), 669);
  // first Shelley block of mainnet: slot 4492800 at 2020-07-29T21:44:51Z, start of epoch 208
  const shelley = Date.parse("2020-07-29T21:44:51Z") / 1000;
  assert.equal(unixToSlot(shelley, network("mainnet")), 4492800);
  assert.equal(unixToEpoch(shelley, network("mainnet")), 208);
  // preprod: Shelley started with epoch 4 at slot 86400 on 2022-06-21T00:00:00Z
  const preprodShelley = Date.parse("2022-06-21T00:00:00Z") / 1000;
  assert.equal(unixToSlot(preprodShelley, network("preprod")), 86400);
  assert.equal(unixToEpoch(preprodShelley, network("preprod")), 4);
});

test("the app defaults to mainnet", () => {
  assert.equal(NETWORK.name, "mainnet");
  assert.equal(NETWORK.id, 1);
});

// ---------------------------------------------------------------------------
// Browse feed
// ---------------------------------------------------------------------------

test("the feed collapses a policy with several tokens into one entry", () => {
  const token = (policy, fingerprint, mintId) => ({ maPolicyId: policy, maFingerprint: fingerprint, maMintId: mintId, maName: "" });
  const feed = [token("a", "a1", 9), token("b", "b1", 8), token("a", "a2", 7), token("c", "c1", 6), token("a", "a3", 5), token("b", "b2", 4), token("a", "a1", 3)];
  const entries = groupFeed(feed);

  // policy a has three different tokens and takes the place of its first one, b and c stay single
  assert.deepEqual(
    entries.map((entry) => (entry.kind === "collection" ? `${entry.policyId}:${entry.tokens.map((t) => t.maFingerprint).join("+")}` : entry.token.maFingerprint)),
    ["a:a1+a2+a3", "b1", "c1", "b2"]
  );
  // below the threshold nothing is grouped
  assert.equal(groupFeed(feed.slice(0, 4)).every((entry) => entry.kind === "token"), true);
});

test("the feed shows a token that is minted repeatedly only once", () => {
  const token = (policy, fingerprint, mintId, quantity = 1) => ({ maPolicyId: policy, maFingerprint: fingerprint, maMintId: mintId, maName: "", quantity });
  const entries = groupFeed([token("a", "a1", 9), token("b", "b1", 8, 5), token("a", "a1", 7), token("b", "b2", 6, 50), token("a", "a1", 5), token("b", "b1", 4, 20)]);

  // the single entry tells how many tokens its mints created, a token minted once does not
  assert.deepEqual(
    entries.map((entry) => entry.kind === "token" && `${entry.token.maFingerprint}@${entry.token.maMintId}:${entry.minted}`),
    ["a1@9:3", "b1@8:25", "b2@6:undefined"]
  );
});

// ---------------------------------------------------------------------------
// Timelock
// ---------------------------------------------------------------------------

test("the hash of a key-and-time script matches a policy id on mainnet", () => {
  // policy 6733c80f… is `all [sig 406d6b77…, before 235435464]`
  assert.equal(timeScriptHash("406d6b77e423ce1acb989ab000a42a04f82a2ddcdefbc2e6681cb276", "before", 235435464), "6733c80f1aff3eef2faec1f73207794911fc912cf3485cbc44fc1a54");
  // hash of the same script with "after", from cardano-cli
  assert.equal(timeScriptHash("406d6b77e423ce1acb989ab000a42a04f82a2ddcdefbc2e6681cb276", "after", 235435464), "7d4911eb74bf5b4181b549d54ed11029fd339e5a28fc96d87d8347f8");
  assert.throws(() => timeScriptHash("406d", "after", 1));
});

test("the unlock slot of a lock is read from the metadata of its transaction", () => {
  assert.deepEqual(unlockSlotsFromMetadata(JSON.stringify([timelockMetadata(207195309)])), [207195309]);
  // next to other metadata, e.g. a message
  assert.deepEqual(unlockSlotsFromMetadata('[{"msg":["hi"]},{"timelock":5}]'), [5]);
  assert.deepEqual(unlockSlotsFromMetadata('[{"timelock":"5"},{"timelock":-1},{"timelock":1.5},null,7]'), []);
  assert.deepEqual(unlockSlotsFromMetadata(""), []);
  assert.deepEqual(unlockSlotsFromMetadata(undefined), []);
  assert.deepEqual(unlockSlotsFromMetadata("not json"), []);
  assert.deepEqual(unlockSlotsFromMetadata('{"timelock":5}'), []);
});

test("a lock ends in the future and within the longest time", () => {
  const now = Date.UTC(2027, 5, 15, 13, 30) / 1000;
  assert.equal(unlockTimeError(now + 300, now), undefined);
  assert.ok(unlockTimeError(now, now));
  assert.ok(unlockTimeError(NaN, now));
  assert.equal(unlockTimeError(now + MAX_LOCK_DAYS * DAY_SECONDS, now), undefined);
  assert.ok(unlockTimeError(now + MAX_LOCK_DAYS * DAY_SECONDS + 60, now));
});

test("locks without metadata are looked for at every midnight a lock of the first version could end", () => {
  const now = Date.UTC(2027, 5, 15, 13, 30) / 1000;
  const candidates = new Set(candidateUnlockTimes(now));
  const tomorrow = Date.UTC(2027, 5, 16) / 1000;
  assert.ok(candidates.has(FIRST_UNLOCK_UNIX));
  assert.ok(candidates.has(tomorrow));
  assert.ok(candidates.has(tomorrow + (MAX_LOCK_DAYS - 1) * DAY_SECONDS));
});

// ---------------------------------------------------------------------------
// Staking check
// ---------------------------------------------------------------------------

const ADA = 1_000_000;
const healthyPool = { poolHash: "pool1a", margin: 0.01, fixedCost: 170 * ADA, pledge: 0, activeStake: 5_000_000 * ADA, delegators: 100, saturationStake: 78_000_000 * ADA };
const steadyResults = { fromEpoch: 658, toEpoch: 667, roa: 2.2, networkRoa: 2.1, lifetimeBlocks: 500, blocks: Array.from({ length: 12 }, (_, i) => ({ epoch: 658 + i, blocks: 3 })) };
const levels = (findings) => findings.map((finding) => finding.level);

test("a healthy pool has nothing to report and needs no alternatives", () => {
  const findings = poolFindings(healthyPool, steadyResults, 669);
  assert.deepEqual(levels(findings), ["ok"]);
  assert.equal(suggestsAlternatives(findings), false);
});

test("a retired pool is the only thing said about it, a retiring one comes with the time left", () => {
  const retired = poolFindings({ ...healthyPool, retiringEpoch: 669, margin: 0.5 }, steadyResults, 669);
  assert.deepEqual(levels(retired), ["problem"]);
  assert.match(retired[0].title, /retired/);

  const retiring = poolFindings({ ...healthyPool, retiringEpoch: 672 }, steadyResults, 669);
  assert.deepEqual(levels(retiring), ["warning"]);
  assert.match(retiring[0].text, /3 epochs, about 15 days/);
  assert.equal(suggestsAlternatives(retiring), true);
});

test("saturation is a warning above the limit and a note close to it", () => {
  assert.deepEqual(levels(poolFindings({ ...healthyPool, activeStake: 80_000_000 * ADA }, steadyResults, 669)), ["warning"]);
  const close = poolFindings({ ...healthyPool, activeStake: 76_000_000 * ADA }, steadyResults, 669);
  assert.deepEqual(levels(close), ["info"]);
  assert.equal(suggestsAlternatives(close), false);
});

test("no blocks is a problem for a large pool and a matter of luck for a small one", () => {
  const none = { ...steadyResults, roa: null, blocks: steadyResults.blocks.map((epoch) => ({ ...epoch, blocks: 0 })) };
  assert.deepEqual(levels(poolFindings(healthyPool, none, 669)), ["problem"]);
  assert.deepEqual(levels(poolFindings({ ...healthyPool, activeStake: 200_000 * ADA }, none, 669)), ["warning"]);
  // a small pool with few blocks and a low return is not blamed for its luck
  const unlucky = { ...steadyResults, roa: 0.9 };
  assert.deepEqual(levels(poolFindings({ ...healthyPool, activeStake: 200_000 * ADA }, unlucky, 669)), ["ok"]);
  assert.deepEqual(levels(poolFindings(healthyPool, unlucky, 669)), ["warning"]);
});

test("high and rising fees are reported, the most serious finding first", () => {
  const findings = poolFindings({ ...healthyPool, margin: 0.08, nextMargin: 0.15, nextFixedCost: 340 * ADA, activeStake: 76_000_000 * ADA }, steadyResults, 669);
  assert.deepEqual(levels(findings), ["warning", "warning", "info", "info"]);
  assert.match(findings[0].title, /8 %/);
  assert.match(findings[1].title, /15 %/);
});

test("the margin costs what the pool keeps of the return before it reaches the delegator", () => {
  // 100 000 ₳ at 2 % net with a 5 % margin: 2000 ₳ are 95 % of what was shared, the margin took 105.26 ₳
  assert.equal(marginCostPerYear(100_000 * ADA, 0.05, 2), 105_263_158);
  assert.equal(marginCostPerYear(100_000 * ADA, 0, 2), 0);
  assert.equal(marginCostPerYear(0, 0.05, 2), 0);
  assert.equal(marginCostPerYear(100_000 * ADA, 1, 2), 0);
});

test("a vote delegation is told apart from none", () => {
  assert.equal(drepKind(null), "none");
  assert.equal(drepKind("drep_always_abstain"), "abstain");
  assert.equal(drepKind("drep_always_no_confidence"), "no_confidence");
  assert.equal(drepKind("drep13d6sxkyz6st9h65qqrzd8ukpywhr8swe9f6357qntgjqye0gttd"), "drep");
});

test("alternatives always include the given pool, never the current one, and stay the same for an address", () => {
  const candidates = Array.from({ length: 20 }, (_, i) => ({ poolHash: `pool${i}` }));
  const tools = { poolHash: "pool5" };
  const picked = pickAlternatives(candidates, "pool7", tools, "stake1abc");
  assert.equal(picked.length, 3);
  assert.equal(picked[0].poolHash, "pool5");
  assert.ok(!picked.some((pool) => pool.poolHash === "pool7"));
  assert.equal(new Set(picked.map((pool) => pool.poolHash)).size, 3);
  assert.deepEqual(pickAlternatives(candidates, "pool7", tools, "stake1abc"), picked);
  // delegated to the given pool already: it is not suggested to itself
  assert.ok(!pickAlternatives(candidates, "pool5", tools, "stake1abc").some((pool) => pool.poolHash === "pool5"));
  assert.deepEqual(pickAlternatives([], null, tools, "x"), [tools]);
});

// ---------------------------------------------------------------------------
// Staking rewards report
// ---------------------------------------------------------------------------

const EPOCH = 432000;
const epochStart = (epoch) => new Date((1506203091 + epoch * EPOCH) * 1000).toISOString();
const rewardRow = (epoch, rewards, operations = ["REWARD_member"]) => ({ timestamp: epochStart(epoch), epoch, rewards, operations });

test("a reward counts when it is paid out, two epochs after it was earned, at that day's price", () => {
  const payout = Date.parse(epochStart(602)) / 1000;
  const prices = [
    [payout - 86400, 0.4],
    [payout, 0.5],
    [payout + 86400, 0.6],
  ];
  const [entry] = rewardEntries([rewardRow(600, 10_000_000)], (unix) => priceAt(prices, unix), EPOCH);
  assert.equal(entry.earnedEpoch, 600);
  assert.equal(entry.payoutEpoch, 602);
  assert.equal(entry.payoutTime, epochStart(602));
  assert.equal(entry.price, 0.5);
  assert.equal(entry.fiat, 5);
  assert.equal(entry.operator, false);
});

test("only staking rewards are income: refunds, treasury payouts and transactions are left out", () => {
  const rows = [
    rewardRow(600, 10_000_000),
    rewardRow(601, 500_000_000, ["REWARD_refund"]),
    rewardRow(602, 7_000_000, ["REWARD_treasury"]),
    rewardRow(603, 3_000_000, ["REWARD_leader"]),
    { timestamp: epochStart(604), epoch: 604, rewards: 0, operations: ["IN", "OUT"] },
  ];
  const entries = rewardEntries(rows, () => undefined, EPOCH);
  assert.deepEqual(entries.map((entry) => [entry.earnedEpoch, entry.operator]), [[600, false], [603, true]]);
  assert.equal(entries[0].fiat, undefined);
});

test("the year of a reward is the year of its payout, and a year says how many values are missing", () => {
  // epochs 529 and 530 are paid in epochs 531 (30 Dec 2024) and 532 (4 Jan 2025)
  const entries = rewardEntries([rewardRow(529, 10_000_000), rewardRow(530, 20_000_000), rewardRow(531, 30_000_000)], (unix) => (unix < Date.UTC(2025, 0, 6) / 1000 ? 1 : undefined), EPOCH);
  assert.deepEqual(entries.map((entry) => entry.payoutTime.slice(0, 10)), ["2024-12-30", "2025-01-04", "2025-01-09"]);
  assert.deepEqual(yearTotals(entries), [
    { year: 2025, rewards: 2, lovelace: 50_000_000, fiat: 20, unpriced: 1 },
    { year: 2024, rewards: 1, lovelace: 10_000_000, fiat: 10, unpriced: 0 },
  ]);
  assert.equal(isPaid(entries[0], Date.UTC(2024, 11, 29) / 1000), false);
  assert.equal(isPaid(entries[0], Date.UTC(2024, 11, 31) / 1000), true);
});

test("the rewards report exports one line per payout", () => {
  const entries = rewardEntries([rewardRow(529, 12_345_678)], () => 0.9, EPOCH);
  assert.equal(
    rewardCsv(entries, "EUR"),
    "Payout date,Payout epoch,Earned in epoch,Kind,Reward ADA,Price EUR,Value EUR\r\n2024-12-30,531,529,staking reward,12.345678,0.900000,11.11"
  );
});

// ---------------------------------------------------------------------------
// Telegram alerts
// ---------------------------------------------------------------------------

const WATCHED = "stake1u8gnr7qurn3j0k7vmqtv8c3zunppuym0s0s0s9a7pya9pfqdjvep8";

test("the bot takes a stake address from the link of the site, as a plain message and with commands", () => {
  assert.deepEqual(parseCommand(`/start ${WATCHED}`), { kind: "subscribe", stakeAddress: WATCHED });
  assert.deepEqual(parseCommand(`  ${WATCHED}  `), { kind: "subscribe", stakeAddress: WATCHED });
  assert.deepEqual(parseCommand("/start"), { kind: "help" });
  assert.deepEqual(parseCommand("/start stake1tooshort"), { kind: "unknown" });
  assert.deepEqual(parseCommand("/LIST"), { kind: "list" });
  assert.deepEqual(parseCommand("/list@CardanoToolsBot"), { kind: "list" });
  assert.deepEqual(parseCommand("/stop"), { kind: "stop" });
  assert.deepEqual(parseCommand("/stop all"), { kind: "stop" });
  assert.deepEqual(parseCommand("/stop 2"), { kind: "stop", index: 2 });
  assert.deepEqual(parseCommand("/stop 0"), { kind: "unknown" });
  assert.deepEqual(parseCommand("hello"), { kind: "unknown" });
});

test("alerts are what calls for attention: pool problems and warnings, and a missing choice about the vote", () => {
  const pool = { poolHash: "pool1a", ticker: "ABC" };
  const findings = [
    { level: "warning", title: "This pool retires in epoch 672", text: "soon" },
    { level: "info", title: "This pool is close to saturation", text: "97 %" },
  ];
  assert.deepEqual(alertsOf({ registered: true, pool, drepId: "drep_always_abstain" }, findings).map((alert) => alert.key), ["pool:pool1a:This pool retires in epoch 672"]);
  assert.deepEqual(alertsOf({ registered: true, pool, drepId: null }, [{ level: "ok", title: "Nothing stands out", text: "" }]).map((alert) => alert.key), ["no-vote"]);
  assert.deepEqual(alertsOf({ registered: false }, findings).map((alert) => alert.key), ["unregistered"]);
  assert.deepEqual(alertsOf({ registered: true, pool: null }, []).map((alert) => alert.key), ["undelegated"]);
});

test("an alert is reported once, again when it changes and again for another pool", () => {
  const retiring = (epoch, poolHash = "pool1a") => alertsOf({ registered: true, pool: { poolHash }, drepId: "drep1x" }, [{ level: "warning", title: `This pool retires in epoch ${epoch}`, text: "" }]);
  const known = retiring(672).map((alert) => alert.key);
  assert.equal(newAlerts(known, retiring(672)).length, 0);
  assert.equal(newAlerts(known, retiring(673)).length, 1);
  assert.equal(newAlerts(known, retiring(672, "pool1b")).length, 1);
  assert.equal(newAlerts([], retiring(672)).length, 1);
});

test("the bot's messages name the address, the pool and the page with the details", () => {
  const alerts = alertsOf({ registered: true, pool: { poolHash: "pool1a", ticker: "ABC" }, drepId: null }, []);
  const welcome = welcomeMessage(WATCHED, { registered: true, pool: { poolHash: "pool1a", ticker: "ABC" } }, alerts, "https://cardano-tools.io");
  assert.match(welcome, /Watching stake1u8gnr7…djvep8, staked with \[ABC\]\./);
  assert.match(welcome, /• The choice about the voting rights is open/);
  assert.match(welcome, new RegExp(`https://cardano-tools.io/check/${WATCHED}`));
  assert.match(welcomeMessage(WATCHED, { registered: true, pool: { poolHash: "pool1a" } }, [], "https://x"), /Nothing stands out right now/);
  assert.match(alertMessage(WATCHED, alerts, "https://cardano-tools.io"), /^News for stake1u8gnr7…djvep8:\n\nThe choice about the voting rights is open\n/);
  assert.match(listMessage([{ stakeAddress: WATCHED }]), /1\. stake1u8gnr7/);
  const summary = watchSummary({ registered: true, pool: { poolHash: "pool1a", ticker: "ABC" } }, alerts, [{ txHash: "aa", txIndex: 0, unlockSlot: 1000, lovelace: 1, tokens: 0 }], 999, 1591566291);
  assert.equal(summary, "staked with [ABC], The choice about the voting rights is open, 1 timelock closed, the next opens 2020-06-07 22:01 UTC");
  assert.equal(watchSummary({ registered: false }, alertsOf({ registered: false }, []), [], 0, 0), "not staking, no timelocks");
  assert.match(listMessage([{ stakeAddress: WATCHED, summary }]), /djvep8\nNow: staked with \[ABC\].*\n\nFor each I write when its pool retires/);
  assert.match(listMessage([]), /not watching any address/);
});

test("the bot finds the locks of an address and reports each once it has opened", () => {
  const SLOT_ZERO = 1591566291;
  const rows = [
    // a lock of ADA with one token, made by a transaction that names its slot
    { txHash: "aa", txIndex: 0, owningAddress: "addr1zlock", value: 25_000_000 },
    { txHash: "aa", txIndex: 0, owningAddress: "addr1zlock", value: 1, maPolicyId: "f0" },
    { txHash: "bb", txIndex: 1, owningAddress: "addr1zlater", value: 5_000_000 },
    // a script output of another kind, and the wallet's ordinary ADA
    { txHash: "cc", txIndex: 0, owningAddress: "addr1zcontract", value: 2_000_000 },
    { txHash: "aa", txIndex: 1, owningAddress: "addr1qchange", value: 9_000_000 },
  ];
  const locks = locksOf(rows, (txHash) => ({ aa: 1000, bb: 5000 })[txHash]);
  assert.deepEqual(locks, [
    { txHash: "aa", txIndex: 0, unlockSlot: 1000, lovelace: 25_000_000, tokens: 1 },
    { txHash: "bb", txIndex: 1, unlockSlot: 5000, lovelace: 5_000_000, tokens: 0 },
  ]);

  assert.deepEqual(lockAlerts(locks, 999, SLOT_ZERO, "https://x"), []);
  const opened = lockAlerts(locks, 1000, SLOT_ZERO, "https://x");
  assert.deepEqual(opened.map((alert) => alert.key), ["lock:aa#0"]);
  assert.equal(opened[0].text, "25 ₳ and a token, locked until 2020-06-07 22:01 UTC, can be taken back now: https://x/timelock");
  // known after the first message, and gone once the output is spent
  assert.equal(newAlerts(["lock:aa#0"], opened).length, 0);
  assert.equal(lockAlerts(locksOf(rows.slice(2), () => 5000), 1000, SLOT_ZERO, "https://x").length, 0);

  assert.equal(pendingLocksLine(locks, 999, SLOT_ZERO), "2 timelocks are still closed, the next opens 2020-06-07 22:01 UTC. I write when one opens.");
  assert.equal(pendingLocksLine(locks, 1000, SLOT_ZERO), "1 timelock is still closed, the next opens 2020-06-07 23:08 UTC. I write when one opens.");
  assert.equal(pendingLocksLine(locks, 5000, SLOT_ZERO), undefined);

  // a message about a lock alone does not point to the staking check
  assert.doesNotMatch(alertMessage(WATCHED, opened, "https://x"), /other pools/);
  assert.match(welcomeMessage(WATCHED, { registered: true, pool: { poolHash: "pool1a" } }, [], "https://x", "1 timelock is still closed."), /Nothing stands out right now\.\n\n1 timelock is still closed\./);
});

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

const govAction = (patch = {}) => ({ type: "InfoAction", submittedEpoch: 664, expiresEpoch: 671, ...patch });

test("an action is open until it expires, and its outcome counts once it has one", () => {
  assert.equal(actionStatus(govAction(), 669).state, "open");
  assert.match(actionStatus(govAction(), 669).text, /2 epochs, about 10 days/);
  assert.match(actionStatus(govAction(), 671).text, /ends with this epoch/);
  assert.equal(actionStatus(govAction(), 672).state, "expired");
  assert.equal(actionStatus(govAction({ expiredEpoch: 671, droppedEpoch: 672 }), 673).label, "Not approved");
  assert.equal(actionStatus(govAction({ ratifiedEpoch: 670 }), 670).label, "Approved");
  assert.equal(actionStatus(govAction({ ratifiedEpoch: 670, enactedEpoch: 671 }), 672).state, "enacted");
  assert.equal(actionStatus(govAction({ droppedEpoch: 668 }), 669).state, "dropped");
});

test("an action without readable metadata is described by what it is", () => {
  assert.equal(actionTitle({ type: "ParameterChange", title: "  Reduce minPoolCost  " }), "Reduce minPoolCost");
  assert.equal(actionTitle({ type: "TreasuryWithdrawals", title: null, withdrawal: 600_000_000_000 }), "Treasury withdrawal of 600,000 ₳");
  assert.equal(actionTitle({ type: "InfoAction", title: "" }), "Poll without a readable title");
});

test("a vote reads differently for who votes and for what is voted on", () => {
  assert.equal(voteOfAddress("drep", "Yes", "open"), "voted yes");
  assert.equal(voteOfAddress("drep", "Abstain", "enacted"), "abstained");
  assert.equal(voteOfAddress("drep", null, "open"), "has not voted yet");
  assert.equal(voteOfAddress("drep", null, "expired"), "did not vote");
  assert.equal(voteOfAddress("abstain", null, "open"), "does not take part");
  assert.match(voteOfAddress("none", null, "open"), /not counted/);

  assert.equal(poolsVoteOn("TreasuryWithdrawals"), false);
  assert.equal(poolsVoteOn("HardForkInitiation"), true);
  assert.equal(voteOfPool("TreasuryWithdrawals", null, "open"), "pools do not vote on this");
  assert.equal(voteOfPool("InfoAction", "Abstain", "open"), "abstained");
  assert.equal(voteOfPool("InfoAction", null, "open"), "has not voted yet");
  assert.equal(voteOfPool("InfoAction", null, "expired"), "did not vote");
});

test("open actions come first, the one ending soonest on top, then the closed ones newest first", () => {
  const actions = [
    govAction({ title: "closed old", expiresEpoch: 660, expiredEpoch: 660 }),
    govAction({ title: "open late", expiresEpoch: 675 }),
    govAction({ title: "closed new", expiresEpoch: 668, enactedEpoch: 669 }),
    govAction({ title: "open soon", expiresEpoch: 671 }),
  ];
  assert.deepEqual(sortActions(actions, 669).map((action) => action.title), ["open soon", "open late", "closed new", "closed old"]);
});

test("the rewards of a year are totalled per month, with a line for a month without a payout", () => {
  // paid out on 30 Dec 2024, 4 Jan, 9 Jan and 15 Mar 2025
  const entries = rewardEntries([rewardRow(529, 10_000_000), rewardRow(530, 20_000_000), rewardRow(531, 30_000_000), rewardRow(544, 5_000_000)], (unix) => (unix < Date.UTC(2025, 1, 1) / 1000 ? 0.5 : undefined), EPOCH);
  assert.deepEqual(entries.map((entry) => entry.payoutTime.slice(0, 10)), ["2024-12-30", "2025-01-04", "2025-01-09", "2025-03-15"]);
  assert.deepEqual(monthTotals(entries, 2025), [
    { month: "2025-01", rewards: 2, lovelace: 50_000_000, fiat: 25, unpriced: 0 },
    { month: "2025-02", rewards: 0, lovelace: 0, fiat: 0, unpriced: 0 },
    { month: "2025-03", rewards: 1, lovelace: 5_000_000, fiat: 0, unpriced: 1 },
  ]);
  assert.deepEqual(monthTotals(entries, 2024).map((month) => month.month), ["2024-12"]);
  assert.deepEqual(monthTotals(entries, 2023), []);
  assert.equal(monthCsv(monthTotals(entries, 2025), "EUR").split("\r\n")[1], "2025-01,2,50.000000,25.00,0");
});
