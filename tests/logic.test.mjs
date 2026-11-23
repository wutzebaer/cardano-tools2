// Tests for the logic that needs neither a wallet nor the chain. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { groupFeed } from "../app/browse/groupTokens.ts";
import { distribute, NotEnoughFundsError, ONE_ADA, TIP_STAKE_ADDRESS } from "../app/cardano/distribution.ts";
import { assetNameFor, tokenMetadata, tokensFromMetadata, tokensMetadata } from "../app/cardano/metadata.ts";
import { NETWORK, NETWORKS, unixToEpoch, unixToSlot } from "../app/cardano/network.ts";
import { candidateUnlockTimes, DAY_SECONDS, FIRST_UNLOCK_UNIX, MAX_LOCK_DAYS, timelockMetadata, timeScriptHash, unlockSlotsFromMetadata, unlockTimeError } from "../app/cardano/timelockScript.ts";
import { policyLockSlot } from "../app/cardano/utils.ts";
import { priceAt, statementCsv, statementLines } from "../app/statement/statement.ts";

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

test("policy lock is the earliest before-slot of the script", () => {
  assert.equal(policyLockSlot('{"type":"all","scripts":[{"type":"sig","keyHash":"aa"},{"type":"before","slot":500},{"type":"any","scripts":[{"type":"before","slot":300}]}]}'), 300);
  assert.equal(policyLockSlot('{"type":"sig","keyHash":"aa"}'), undefined);
  assert.equal(policyLockSlot(null), undefined);
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
