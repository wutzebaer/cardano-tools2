// Tests for the logic that needs neither a wallet nor the chain. Run with `npm test`.
// the reports group by local time, the expectations below are written for UTC
process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { test } from "node:test";
import { battleLines, battleNote, battlesByEpoch, chanceOfAtLeast, duePoolPosts, epochStartNote, FUN_FACTS, funFact, planFunFact, shortAda, formatStake, initialPoolPostState, luck, planCaption, resultCaption, scheduledBlocks } from "../app/alerts/poolPosts.ts";
import { alertMessage, alertsOf, listMessage, lockAlerts, locksOf, newAlerts, parseCommand, pendingLocksLine, watchSummary, welcomeMessage } from "../app/alerts/alertLogic.ts";
import { groupFeed } from "../app/browse/groupTokens.ts";
import { distribute, NotEnoughFundsError, ONE_ADA, TIP_STAKE_ADDRESS } from "../app/cardano/distribution.ts";
import { drepKind, marginCostPerYear, pickAlternatives, poolFindings, suggestsAlternatives } from "../app/check/checkLogic.ts";
import { actionStatus, actionTitle, poolsVoteOn, sortActions, voteOfAddress, voteOfPool } from "../app/votes/governanceLogic.ts";
import { assetNameFor, cip25Metadata, tokenMetadata, tokensFromMetadata, tokensMetadata } from "../app/cardano/metadata.ts";
import { assetNameText, isPresentable } from "../app/cardano/readableName.ts";
import { DROP_BLUEPRINT_HASH, DROP_CODE, DROP_TERM_BITS } from "../app/cardano/dropBlueprint.ts";
import {
  applyDropParams,
  Constr,
  freshSold,
  groupDatum,
  groupOfDatum,
  groupOfMarker,
  isSold,
  listErrors,
  markerName,
  MAX_GROUPS,
  merkleProof,
  merkleRoot,
  merkleTree,
  metadataDatum,
  parseDropList,
  plutusCbor,
  plutusFromCbor,
  scriptHash,
  sizeOfGroup,
  suggestedGroups,
  tickSold,
} from "../app/cardano/dropScript.ts";
import { NETWORK, NETWORKS, unixToEpoch, unixToSlot } from "../app/cardano/network.ts";
import { collectionNameError, policyRegistration } from "../app/cardano/registration.ts";
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
// Collection registration (CIP-88)
// ---------------------------------------------------------------------------

test("a policy registers its collection name with the royalty token as proof", () => {
  const policyId = "3668b628d7bd0cbdc4b7a60fe9bd327b56a1902e89fd01251a34c8be";
  const scriptCbor = "8200581c4bdb4c5017cdcb50c001af21d2488ed2e741df55b252dd3ab2482050".repeat(3);
  const registration = policyRegistration({ policyId, scriptCbor, name: " Cool NFT Project ", royalty: { rate: "0.05", addr: ["addr_test1qqp7", "lpy25"] }, nonce: 12345 });
  // maps with number keys to plain objects, to read the registration like its reader does
  const plain = (value) =>
    "map" in value ? Object.fromEntries(value.map.map(({ k, v }) => [k.int, plain(v)])) : "list" in value ? value.list.map(plain) : "bytes" in value ? `0x${value.bytes}` : (value.int ?? value.string);
  const read = plain(registration);

  assert.equal(read[0], 1);
  assert.deepEqual(read[2], []);
  const payload = read[1];
  assert.equal(payload[1][0], 0);
  assert.equal(payload[1][1], `0x${policyId}`);
  assert.equal(payload[1][2].map((piece) => piece.slice(2)).join(""), scriptCbor);
  assert.ok(payload[1][2].every((piece) => piece.length <= 2 + 128));
  assert.deepEqual(payload[2], [25, 27]);
  assert.deepEqual(payload[3], [1, [`0x${policyId}`, "0x"]]);
  assert.equal(payload[4], 12345);
  assert.deepEqual(payload[6][25], { 0: 1, 1: { 0: "Cool NFT Project" } });
  assert.deepEqual(payload[6][27], { 0: 1, 1: { 1: "0.05", 2: ["addr_test1qqp7", "lpy25"] } });

  // description and picture are cut into pieces of at most 64 bytes, between characters
  const long = `${"ä".repeat(40)} and a text that goes on for a while, well past the first piece`;
  const image = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const full = plain(policyRegistration({ policyId, scriptCbor, name: "Name", description: ` ${long} `, image, nonce: 1 }))[1][6][25][1];
  assert.equal(full[1].join(""), long);
  assert.ok(full[1].length > 1 && full[1].every((piece) => new TextEncoder().encode(piece).length <= 64));
  assert.equal(full[2].join(""), image);
  assert.ok(full[2].every((piece) => piece.length <= 64));
  assert.deepEqual(Object.keys(payload[6][25][1]), ["0"]);

  const plainOnly = plain(policyRegistration({ policyId, scriptCbor, name: "Name", nonce: 1 }));
  assert.deepEqual(plainOnly[1][2], [25]);
  assert.equal(plainOnly[1][6][27], undefined);

  assert.equal(collectionNameError("Robots"), undefined);
  assert.equal(collectionNameError("  "), "Needs a name");
  assert.equal(collectionNameError("x".repeat(65)), "At most 64 bytes");
  assert.equal(collectionNameError("ä".repeat(33)), "At most 64 bytes");
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

test("CIP-25 metadata lists the tokens by asset name and cuts long texts into pieces", () => {
  const long = "ä".repeat(40);
  const metadata = cip25Metadata("ab".repeat(28), [token({ description: long, extra: { traits: ["a", "b"], rank: 3 } })]);
  assert.deepEqual(Object.keys(metadata), ["ab".repeat(28)]);
  const entry = metadata["ab".repeat(28)].Token001;
  assert.equal(entry.name, "Token 001");
  assert.equal(entry.image, "ipfs://QmImage");
  // 40 characters of two bytes each: 32 fit into the 64 bytes of a piece
  assert.deepEqual(entry.description, ["ä".repeat(32), "ä".repeat(8)]);
  assert.deepEqual(entry.traits, ["a", "b"]);
  assert.equal(entry.rank, 3);
});

test("tokens named by a hash and without a picture stay out of the feed", () => {
  const hex = (text) => Buffer.from(text, "utf8").toString("hex");
  assert.equal(isPresentable({ maName: hex("Foxxy002"), name: "Foxxy #2", image: "" }), true);
  assert.equal(isPresentable({ maName: "000de140" + hex("Foxxy002"), name: "", image: "" }), true);
  // a name of raw bytes, as contracts use for their own bookkeeping
  assert.equal(isPresentable({ maName: "f3a9c1ffee0102", name: "\uFFFD\uFFFD", image: "" }), false);
  assert.equal(isPresentable({ maName: "f3a9c1ffee0102", name: "", image: "" }), false);
  // with a picture it is somebody's token after all
  assert.equal(isPresentable({ maName: "f3a9c1ffee0102", name: "Fluid tokens bond", image: "ipfs://Qm" }), true);
  // the royalty token
  assert.equal(isPresentable({ maName: "", name: "", image: "" }), true);
});

test("an asset name is text only where its bytes are", () => {
  const hex = (text) => Buffer.from(text, "utf8").toString("hex");
  assert.equal(assetNameText(hex("Foxxy002")), "Foxxy002");
  assert.equal(assetNameText("000de140" + hex("Foxxy002")), "Foxxy002");
  assert.equal(assetNameText("f3a9c1ffee0102"), undefined);
  assert.equal(assetNameText(""), undefined);
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
// Posts about the pool
// ---------------------------------------------------------------------------

test("the bot reads the scheduled blocks per epoch from the leaderlog metrics", () => {
  const metrics = [
    "# TYPE cardano_leaderlog_scheduled_blocks untyped",
    'cardano_leaderlog_scheduled_blocks{epoch="669",instance="",job="leaderlog"} 1',
    'cardano_leaderlog_scheduled_blocks{instance="",job="leaderlog",epoch="670"} 0',
    'cardano_leaderlog_scheduled_blocks{epoch="671",instance="",job="leaderlog"} NaN',
    'other_metric{epoch="672"} 5',
  ].join("\n");
  assert.deepEqual([...scheduledBlocks(metrics)], [[669, 1], [670, 0]]);
});

test("a plan is posted once the leaderlog is there, a result once the chain has left the epoch", () => {
  const start = initialPoolPostState(669);
  assert.deepEqual(start, { plan: 669, result: 668 });
  // nothing about the past, and no plan before the leaderlog
  assert.deepEqual(duePoolPosts(start, 669, 669, new Map([[669, 1]])), []);
  assert.deepEqual(duePoolPosts(start, 669, 669, new Map([[670, 2]])), [{ kind: "plan", epoch: 670, post: true }]);
  // an epoch without a block is ticked off without a post
  assert.deepEqual(duePoolPosts(start, 669, 669, new Map([[670, 0]])), [{ kind: "plan", epoch: 670, post: false }]);
  assert.deepEqual(duePoolPosts({ plan: 670, result: 668 }, 669, 669, new Map([[670, 2]])), []);
  // the clock is in 670, the chain data follows a moment later
  assert.deepEqual(duePoolPosts({ plan: 670, result: 668 }, 670, 669, new Map()), []);
  assert.deepEqual(duePoolPosts({ plan: 670, result: 668 }, 670, 670, new Map()), [{ kind: "result", epoch: 669, post: true }]);
});

test("the posts say what was scheduled and made, next to what the stake lets expect", () => {
  const facts = { epoch: 670, blocks: 2, stake: 737_207_901_965, delegators: 209, expectedBlocks: 0.7399 };
  assert.equal(luck(2, 0.7399), 270);
  assert.equal(luck(2, null), undefined);
  assert.equal(formatStake(facts.stake), "737,208 ₳");
  assert.equal(planCaption("TOOLS", facts, 2, "https://x"), "[TOOLS] is scheduled for 2 blocks in epoch 670.\nIts stake lets expect 0.74, so the epoch is a lucky one with 270 %.\n\nhttps://x/pool");
  assert.equal(
    resultCaption("TOOLS", facts, 2, "https://x"),
    "[TOOLS] forged 2 of 2 scheduled blocks in epoch 670.\nIts stake let expect 0.74, that is 270 % of the average.\nThe rewards of the epoch reach the delegators in two epochs.\n\nhttps://x/pool"
  );
  assert.equal(resultCaption("TOOLS", { ...facts, blocks: 0, expectedBlocks: null }, undefined, "https://x"), "[TOOLS] forged 0 blocks in epoch 670.\n\nhttps://x/pool");
});

test("the bot reads the battles of finished epochs and names who took a block", () => {
  const metrics = [
    'cardano_leaderlog_battles_evaluated{epoch="668",instance="",job="battles"} 1',
    'cardano_leaderlog_missed_blocks{epoch="668",instance="",job="battles"} 0',
    'cardano_leaderlog_battles_evaluated{epoch="669",instance="",job="battles"} 1',
    'cardano_leaderlog_lost_battles{epoch="669",instance="",job="battles",kind="slot",winner="CF3",winner_pool="pool1l0e"} 1',
    'cardano_leaderlog_lost_battles{epoch="669",instance="",job="battles",kind="height",winner="pool1abcdefg",winner_pool="pool1abcdefg"} 2',
    'cardano_leaderlog_missed_blocks{epoch="669",instance="",job="battles"} 1',
    'cardano_leaderlog_scheduled_blocks{epoch="670",instance="",job="leaderlog"} 2',
  ].join("\n");
  const battles = battlesByEpoch(metrics);
  assert.deepEqual([...battles.keys()], [668, 669]);
  assert.deepEqual(battles.get(668), { lost: [], missed: 0 });
  assert.equal(battleNote(battles.get(668)), "");
  assert.equal(battleNote(undefined), "");
  assert.equal(battleNote(battles.get(669)), "lost to [CF3], pool1abcdefg · 1 missed");
  assert.deepEqual(battleLines(669, battles.get(669)), [
    "One block went to [CF3] in a slot battle: both pools were leader in the same slot and the draw favoured them.",
    "2 blocks went to pool1abcdefg in a height battle: their block reached the network first.",
    "One block was missed by our node.",
    "🔥🔱 Pitchforks are being sharpened in the direction of [CF3] and pool1abcdefg.",
  ]);
  const facts = { epoch: 669, blocks: 1, stake: 736_926_000_000, delegators: 209, expectedBlocks: 0.74 };
  assert.equal(
    resultCaption("TOOLS", facts, 2, "https://x", { lost: [{ kind: "slot", winner: "CF3", count: 1 }], missed: 0 }),
    "[TOOLS] forged 1 of 2 scheduled blocks in epoch 669.\nOne block went to [CF3] in a slot battle: both pools were leader in the same slot and the draw favoured them.\n🔥🔱 Pitchforks are being sharpened in the direction of [CF3].\nIts stake let expect 0.74, that is 135 % of the average.\nThe rewards of the epoch reach the delegators in two epochs.\n\nhttps://x/pool"
  );
});

test("every epoch tells another little fact, and a fact without anything to say passes on", () => {
  const numbers = {
    epoch: 669, blocks: 1, transactions: 10, lovelaceMoved: 574_185_199_826, fees: 3_732_476, largestTransaction: 517_823_218_595, blockFill: 0.2506,
    lastBlockNo: 14_228_406, tokenOutputs: 75, scriptRuns: 12, tokensMinted: 3, networkBlocks: 21_516, registeredEpoch: 255, lifetimeBlocks: 577,
    epochsWithBlocks: 193, blockStreak: 1, previousStake: 736_929_848_031, previousDelegators: 209, stakeRank: 966, rankedPools: 2666, delegatorRewards: 185_639_630_110,
  };
  assert.equal(FUN_FACTS.length, 20);
  assert.equal(shortAda(574_185_199_826), "574.2K");
  assert.equal(shortAda(3_732_476), "3.73");
  // with a block every fact but the streak, the delegators and a stake change of 3.8 ADA has something to say
  const told = FUN_FACTS.map((make) => make(numbers, 736_926_000_000, 209)).filter(Boolean);
  assert.equal(told.length, 17);
  for (const fact of told) assert.ok(fact.value.length <= 11 && fact.label === fact.label.toUpperCase() && fact.sentence.startsWith("Fun fact: "), JSON.stringify(fact));
  // 669 % 20 = 9: the block height
  assert.deepEqual(funFact(numbers, 736_926_000_000, 209), { label: "BLOCK HEIGHT", value: "#14,228,406", note: "our latest block", sentence: "Fun fact: our latest block is number 14,228,406 of the Cardano chain." });
  // 671 % 20 = 11 is the streak, too short here: the next fact speaks
  assert.equal(funFact(numbers, 736_926_000_000, 209, 671).label, "EPOCHS WITH A BLOCK");
  // an epoch without a block skips the facts about blocks
  const empty = { ...numbers, blocks: 0, transactions: 0, lovelaceMoved: 0, fees: 0, largestTransaction: null, blockFill: null, lastBlockNo: null, tokenOutputs: 0, scriptRuns: 0, tokensMinted: 0 };
  assert.equal(funFact(empty, 736_926_000_000, 209, 660).label, "LIFETIME BLOCKS");
  assert.equal(funFact(null, 1, 1), null);
  // a plan tells the odds of its luck or a fact from the history
  assert.equal(Math.round(chanceOfAtLeast(2, 0.74) * 1000), 170);
  assert.equal(Math.round(chanceOfAtLeast(1, 0.74) * 1000), 523);
  assert.deepEqual(planFunFact(numbers, 736_926_000_000, 209, 2, 0.74, 670, 0), { label: "ODDS", value: "1 in 6", note: "chance of 2+ blocks", sentence: "Fun fact: only about 1 in 6 epochs brings the pool 2 or more blocks." });
  assert.equal(planFunFact(numbers, 736_926_000_000, 209, 1, 0.74, 670, 0).value, "52 %");
  assert.equal(planFunFact(numbers, 736_926_000_000, 209, 2, 0.74, 670, 1).label, "LIFETIME BLOCKS");
  assert.equal(planFunFact(null, 1, 1, 2, 0.74, 670, 1).label, "ODDS");
  // the plan says when its epoch starts, in UTC
  assert.equal(epochStartNote(Date.UTC(2026, 10, 28, 21, 45) / 1000), "starts Sat 21:45 UTC");
  // dull numbers pass on: a largest transfer of 30 ADA is no fact (index 3), the next one speaks
  const dull = { ...numbers, largestTransaction: 30_000_000, blockFill: 0.05 };
  assert.equal(funFact(dull, 736_926_000_000, 209, 3).label, "TOKEN OUTPUTS");
  // a preview starts where it likes: 0 is the transactions
  assert.equal(funFact(numbers, 736_926_000_000, 209, 0).label, "TRANSACTIONS");
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

// ---------------------------------------------------------------------------
// NFT drop
// ---------------------------------------------------------------------------

const dropTokens = (count) => Array.from({ length: count }, (_, i) => ({ assetName: `Robot${i + 1}`, metadata: { name: `Robot #${i + 1}`, image: `ipfs://Qm${i}` } }));

test("writes Plutus data the way the chain does", () => {
  // constructor with open-ended fields, map with its length and in the given order, empty list closed
  assert.equal(plutusCbor(new Constr(0, [new Map([["6e616d65", "41"], ["696d616765", "42"]]), 1n, []])), "d8799fa2446e616d65414145696d616765414201" + "80ff");
  assert.equal(plutusCbor(new Constr(1, [])), "d87a80");
  assert.equal(plutusCbor(5_000_000n), "1a004c4b40");
  // byte strings over 64 bytes go in pieces
  assert.equal(plutusCbor("ab".repeat(70)), "5f5840" + "ab".repeat(64) + "46" + "ab".repeat(6) + "ff");
});

test("reads Plutus data back, whichever way it was written", () => {
  const data = new Constr(0, [new Map([["6e616d65", ["01", 2n]]]), -3n, "ab".repeat(70)]);
  assert.deepEqual(plutusFromCbor(plutusCbor(data)), data);
  // lists and maps with a length, as other tools write them
  assert.deepEqual(plutusFromCbor("d87982a1446e616d65414101"), new Constr(0, [new Map([["6e616d65", "41"]]), 1n]));
});

test("the metadata datum of a drop token is CIP-68", () => {
  assert.equal(metadataDatum({ assetName: "A", metadata: { name: "A", n: 1 } }), "d8799fa2446e616d654141416e0101ff");
});

test("every token of a list proves itself against the root, and only at its own place", () => {
  const tokens = dropTokens(5);
  const tree = merkleTree(tokens);
  assert.equal(tree[0].length, 8);
  const root = merkleRoot(tree);
  assert.equal(root.length, 64);
  assert.equal(merkleProof(tree, 3).length, 3);
  // a changed token changes the root
  const changed = dropTokens(5);
  changed[3].metadata.image = "ipfs://other";
  assert.notEqual(merkleRoot(merkleTree(changed)), root);
  // a list of one token is its own root
  assert.deepEqual(merkleProof(merkleTree(dropTokens(1)), 0), []);
});

test("a list is refused for what the contract cannot sell", () => {
  assert.deepEqual(listErrors(dropTokens(3)), []);
  assert.match(listErrors([])[0], /empty/);
  assert.match(listErrors([...dropTokens(2), dropTokens(1)[0]])[0], /used twice/);
  assert.match(listErrors([{ assetName: "x".repeat(29), metadata: { name: "x" } }])[0], /1 to 28 bytes/);
  assert.match(listErrors([{ assetName: "x", metadata: {} }])[0], /needs a name/);
});

test("a list is read in the forms creators have", () => {
  const tokens = dropTokens(2);
  assert.deepEqual(parseDropList(tokens), tokens);
  assert.deepEqual(parseDropList({ version: 1, tokens }), tokens);
  assert.deepEqual(parseDropList({ Robot1: tokens[0].metadata, Robot2: tokens[1].metadata }), tokens);
});

test("groups share the tokens and tick them off from the first bit", () => {
  assert.equal(sizeOfGroup(5, 2, 0) + sizeOfGroup(5, 2, 1), 5);
  assert.equal(freshSold(5, 2, 0), "00");
  assert.equal(freshSold(4000, 32, 0), "00".repeat(16));
  assert.equal(tickSold("0000", 0), "8000");
  assert.equal(tickSold("0000", 9), "0040");
  assert.ok(isSold("0040", 9));
  assert.ok(!isSold("0040", 8));
  assert.equal(markerName(1), "6772700001");
  assert.equal(groupOfMarker(markerName(31)), 31);
  assert.equal(groupOfMarker("000de140" + "41"), undefined);
});

test("a drop gets no more groups than one transaction can create", () => {
  assert.equal(suggestedGroups(1), 1);
  assert.equal(suggestedGroups(100), 10);
  assert.equal(suggestedGroups(10000), MAX_GROUPS);
});

test("the datum of a group reads back as written, and other datums are not groups", () => {
  const config = {
    root: "11".repeat(32),
    total: 5,
    groups: 2,
    price: 5_000_000n,
    seller: { payment: { keyHash: "22".repeat(28) }, stake: { keyHash: "33".repeat(28) } },
    owner: "22".repeat(28),
    seed: { txHash: "44".repeat(32), index: 3 },
    burnable: true,
    list: "ipfs://QmList",
  };
  assert.deepEqual(groupOfDatum(groupDatum({ config, group: 1, sold: "80" })), { config, group: 1, sold: "80" });
  const withoutStake = { ...config, seller: { payment: { scriptHash: "55".repeat(28) } } };
  assert.deepEqual(groupOfDatum(groupDatum({ config: withoutStake, group: 0, sold: "00" }))?.config, withoutStake);
  assert.equal(groupOfDatum(metadataDatum({ assetName: "A", metadata: { name: "A" } })), undefined);
  assert.equal(groupOfDatum("zz"), undefined);
});

test("the script of a drop is the one the chain accepted", () => {
  // a drop created on the preview testnet with this build of the contract; changes when the contract is rebuilt
  assert.equal(DROP_BLUEPRINT_HASH, "67d528f9a1bcb8fca605c7b3b59ce8b35a728a4a5f2798efa879f6eb");
  const seed = {"txHash": "6c2dfe0347e1de8d01a083441659accce41b67e629ad0063d837baafe793fb72", "index": 2};
  assert.equal(scriptHash(applyDropParams(DROP_CODE, DROP_TERM_BITS, seed, true)), "0aec62b19a2a78cdd8d200788f3969770f1c5f52ba12bb2ab1520324");
  assert.notEqual(scriptHash(applyDropParams(DROP_CODE, DROP_TERM_BITS, seed, false)), "0aec62b19a2a78cdd8d200788f3969770f1c5f52ba12bb2ab1520324");
});
