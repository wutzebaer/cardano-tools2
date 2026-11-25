import { getPoolCheck, getPoolEpoch } from "@cardano/dbsync";
import { POOL_ID, POOL_TICKER } from "@cardano/pool";
import { ImageResponse } from "next/og";
import { battleNote, battlesByEpoch, formatExpected, formatStake, luck } from "../../../alerts/poolPosts";
import { pushgatewayMetrics } from "../../../alerts/pushgateway";

const SIZE = { width: 1200, height: 630 };

const BRAND = "linear-gradient(90deg, #22d3ee, #6f95ff, #a78bfa)";

/** The ADA sign, drawn: the font of these pictures has no glyph for it. An A with two bars, as tall as a capital. */
function AdaSign() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b93a7" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22 L12 3 L19 22" />
      <path d="M3 13 H21" />
      <path d="M3 17.5 H21" />
    </svg>
  );
}

/** A torch and a pitchfork, for the pool that took one of our blocks. Drawn, the font has no emoji. */
function AngryMob() {
  return (
    <svg width="50" height="32" viewBox="0 0 44 28" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 27 L11 13" stroke="#b07a45" strokeWidth="3" />
      <path d="M8.5 13 H13.5" stroke="#8b93a7" strokeWidth="2.5" />
      <path d="M11 1.5 C15 5.5 15.6 9 14.1 11 C13 12.6 9 12.6 8.2 11 C6.9 9 8.4 5.6 11 1.5 Z" fill="#f97316" />
      <path d="M11 5.8 C12.8 7.8 13 9.6 12.1 10.8 C11.4 11.5 10.1 11.4 9.6 10.7 C9 9.6 9.8 7.9 11 5.8 Z" fill="#facc15" />
      <path d="M33 27 V10.5" stroke="#b07a45" strokeWidth="3" />
      <path d="M26 2 V7 C26 9.5 28 10.5 33 10.5 C38 10.5 40 9.5 40 7 V2 M33 2 V10.5" stroke="#c9cdd8" strokeWidth="2.4" />
    </svg>
  );
}

function Tile({ label, value, accent = false, note = "" }: { label: string; value: string; accent?: boolean; note?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexGrow: 1,
        flexBasis: 0,
        gap: 10,
        padding: "26px 30px",
        borderRadius: 24,
        border: `2px solid ${accent ? "rgba(139, 158, 255, 0.55)" : "rgba(255, 255, 255, 0.1)"}`,
        background: accent ? "rgba(77, 124, 254, 0.16)" : "rgba(255, 255, 255, 0.04)",
      }}
    >
      <div style={{ display: "flex", fontSize: 20, letterSpacing: 2, whiteSpace: "nowrap", color: "#8b93a7" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: accent ? "#ffffff" : "#e6e8ee" }}>{value}</div>
      {note ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, color: "#fdba74" }}>
          {note.includes("lost to") ? <AngryMob /> : null}
          {/* several winners take two lines rather than leave the tile */}
          <span style={{ display: "flex", textAlign: "center", maxWidth: 220 }}>{note}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The picture of a post about the site's pool: `plan` for the blocks an epoch holds, `result` for what the pool
 * made of it. The number of scheduled blocks comes with the request, the site itself does not know it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; epoch: string }> }) {
  const { kind, epoch: epochText } = await params;
  const epoch = Number(epochText);
  if ((kind !== "plan" && kind !== "result") || !Number.isInteger(epoch) || epoch < 0) return new Response("Not found", { status: 404 });
  const scheduledText = new URL(request.url).searchParams.get("scheduled");
  const scheduled = scheduledText != null && /^\d{1,4}$/.test(scheduledText) ? Number(scheduledText) : undefined;
  if (kind === "plan" && scheduled == null) return new Response("Not found", { status: 404 });

  const [facts, pool, metrics] = await Promise.all([getPoolEpoch(POOL_ID, epoch), getPoolCheck(POOL_ID), kind === "result" ? pushgatewayMetrics() : Promise.resolve("")]);
  if (!facts) return new Response("Not found", { status: 404 });

  const counted = kind === "plan" ? scheduled! : facts.blocks;
  const percent = luck(counted, facts.expectedBlocks);
  const tiles: { label: string; value: string; accent: boolean; note?: string }[] =
    kind === "plan"
      ? [{ label: "SCHEDULED BLOCKS", value: `${scheduled}`, accent: true }]
      : [
          {
            label: scheduled != null ? "BLOCKS FORGED" : "BLOCKS",
            value: scheduled != null ? `${facts.blocks} / ${scheduled}` : `${facts.blocks}`,
            accent: true,
            note: battleNote(battlesByEpoch(metrics).get(epoch)),
          },
        ];
  if (facts.expectedBlocks != null) tiles.push({ label: "EXPECTED BY STAKE", value: formatExpected(facts.expectedBlocks), accent: false });
  if (percent != null) tiles.push({ label: "OF THE AVERAGE", value: `${percent} %`, accent: false });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "#e6e8ee",
          background: "radial-gradient(circle at 88% 12%, rgba(34, 211, 238, 0.22), transparent 50%), radial-gradient(circle at 12% 100%, rgba(139, 92, 246, 0.3), transparent 55%), #0b0d11",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30, color: "#8b93a7", letterSpacing: 4 }}>
          <span>{kind === "plan" ? "COMING EPOCH" : "EPOCH RESULT"}</span>
          <span>{pool?.name ? pool.name.toUpperCase() : "STAKE POOL"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28 }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, backgroundImage: BRAND, backgroundClip: "text", color: "transparent" }}>[{POOL_TICKER}]</div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 600, color: "#c9cdd8" }}>Epoch {epoch}</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {tiles.map((tile) => (
            <Tile key={tile.label} {...tile} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30, color: "#8b93a7" }}>
          <span>cardano-tools.io/pool</span>
          {facts.stake > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{formatStake(facts.stake).replace(" ₳", "")}</span>
              <AdaSign />
              <span>staked by {facts.delegators.toLocaleString("en-US")} delegators</span>
            </div>
          ) : (
            <span>Stake with [{POOL_TICKER}]</span>
          )}
        </div>
      </div>
    ),
    SIZE
  );
}
