import { getPoolCheck, getPoolEpoch } from "@cardano/dbsync";
import { POOL_ID, POOL_TICKER } from "@cardano/pool";
import { ImageResponse } from "next/og";
import { formatExpected, formatStake, luck } from "../../../alerts/poolPosts";

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

function Tile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
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

  const [facts, pool] = await Promise.all([getPoolEpoch(POOL_ID, epoch), getPoolCheck(POOL_ID)]);
  if (!facts) return new Response("Not found", { status: 404 });

  const counted = kind === "plan" ? scheduled! : facts.blocks;
  const percent = luck(counted, facts.expectedBlocks);
  const tiles =
    kind === "plan"
      ? [{ label: "SCHEDULED BLOCKS", value: `${scheduled}`, accent: true }]
      : [{ label: scheduled != null ? "BLOCKS MADE" : "BLOCKS", value: scheduled != null ? `${facts.blocks} / ${scheduled}` : `${facts.blocks}`, accent: true }];
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
