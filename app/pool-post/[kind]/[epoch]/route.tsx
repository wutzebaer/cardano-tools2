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

/** An angry mob with torches and a pitchfork, for the pool that took one of our blocks. Drawn, the font has no emoji. */
function AngryMob() {
  return (
    <svg width="81" height="54" viewBox="0 0 72 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 40 L5 13" stroke="#b07a45" strokeWidth="2.6" />
      <path d="M5 2 C9 6 9.5 9 8 11.5 C7 13 3.5 13 2.6 11.5 C1.4 9.3 2.6 6 5 2 Z" fill="#f97316" />
      <path d="M5 5.8 C6.6 7.6 6.8 9.4 6 10.6 C5.4 11.3 4.3 11.2 3.9 10.5 C3.4 9.5 4 7.8 5 5.8 Z" fill="#facc15" />
      <path d="M36 41 V8" stroke="#b07a45" strokeWidth="2.6" />
      <path d="M30 1.5 V6 C30 8.2 31.6 9 36 9 C40.4 9 42 8.2 42 6 V1.5 M36 1.5 V9" stroke="#c9cdd8" strokeWidth="2.2" />
      <path d="M65 40 L67 13" stroke="#b07a45" strokeWidth="2.6" />
      <path d="M67 2 C71 6 71.5 9 70 11.5 C69 13 65.5 13 64.6 11.5 C63.4 9.3 64.6 6 67 2 Z" fill="#f97316" />
      <path d="M67 5.8 C68.6 7.6 68.8 9.4 68 10.6 C67.4 11.3 66.3 11.2 65.9 10.5 C65.4 9.5 66 7.8 67 5.8 Z" fill="#facc15" />
      <path d="M9 48 C9 39 29 39 29 48 Z" fill="#7c3aed" />
      <path d="M13 42 L6 27" stroke="#7c3aed" strokeWidth="3.4" />
      <circle cx="19" cy="31" r="7.5" fill="#f2c9a0" />
      <path d="M13.5 26.5 L17.5 29 M24.5 26.5 L20.5 29" stroke="#3b2a1a" strokeWidth="1.8" />
      <circle cx="16.4" cy="31.2" r="1" fill="#3b2a1a" />
      <circle cx="21.6" cy="31.2" r="1" fill="#3b2a1a" />
      <path d="M16 35.8 Q19 33.2 22 35.8" stroke="#3b2a1a" strokeWidth="1.5" />
      <path d="M43 48 C43 39 63 39 63 48 Z" fill="#2563eb" />
      <path d="M59 42 L66 27" stroke="#2563eb" strokeWidth="3.4" />
      <circle cx="53" cy="31" r="7.5" fill="#f2c9a0" />
      <path d="M47.5 26.5 L51.5 29 M58.5 26.5 L54.5 29" stroke="#3b2a1a" strokeWidth="1.8" />
      <circle cx="50.4" cy="31.2" r="1" fill="#3b2a1a" />
      <circle cx="55.6" cy="31.2" r="1" fill="#3b2a1a" />
      <path d="M50 35.8 Q53 33.2 56 35.8" stroke="#3b2a1a" strokeWidth="1.5" />
      <path d="M26 48 C26 39 46 39 46 48 Z" fill="#dc2626" />
      <path d="M42 42 L36 25" stroke="#dc2626" strokeWidth="3.4" />
      <circle cx="36" cy="31" r="7.5" fill="#f2c9a0" />
      <path d="M30.5 26.5 L34.5 29 M41.5 26.5 L37.5 29" stroke="#3b2a1a" strokeWidth="1.8" />
      <circle cx="33.4" cy="31.2" r="1" fill="#3b2a1a" />
      <circle cx="38.6" cy="31.2" r="1" fill="#3b2a1a" />
      <path d="M33 35.8 Q36 33.2 39 35.8" stroke="#3b2a1a" strokeWidth="1.5" />
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, color: "#fdba74" }}>
          {note.includes("lost to") ? <AngryMob /> : null}
          {/* several winners take two lines rather than leave the tile */}
          <span style={{ display: "flex", maxWidth: 150 }}>{note}</span>
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

  const battles = kind === "result" ? battlesByEpoch(metrics).get(epoch) : undefined;
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
            note: battleNote(battles),
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
