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
    <svg width="108" height="54" viewBox="0 0 96 48" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 40 L6 13" stroke="#b07a45" strokeWidth="2.6" />
      <path d="M6 2 C10 6 10.5 9 9 11.5 C8 13 4.5 13 3.6 11.5 C2.4 9.3 3.6 6 6 2 Z" fill="#f97316" />
      <path d="M6 5.8 C7.6 7.6 7.8 9.4 7 10.6 C6.4 11.3 5.3 11.2 4.9 10.5 C4.4 9.5 5 7.8 6 5.8 Z" fill="#facc15" />
      <path d="M40 41 V8" stroke="#b07a45" strokeWidth="2.6" />
      <path d="M34 1.5 V6 C34 8.2 35.6 9 40 9 C44.4 9 46 8.2 46 6 V1.5 M40 1.5 V9" stroke="#c9cdd8" strokeWidth="2.2" />
      <path d="M88 40 L90 13" stroke="#b07a45" strokeWidth="2.6" />
      <path d="M90 2 C94 6 94.5 9 93 11.5 C92 13 88.5 13 87.6 11.5 C86.4 9.3 87.6 6 90 2 Z" fill="#f97316" />
      <path d="M90 5.8 C91.6 7.6 91.8 9.4 91 10.6 C90.4 11.3 89.3 11.2 88.9 10.5 C88.4 9.5 89 7.8 90 5.8 Z" fill="#facc15" />
      <path d="M7 48 C7 39 27 39 27 48 Z" fill="#7c3aed" />
      <path d="M10 42 L7 27" stroke="#7c3aed" strokeWidth="3.4" />
      <circle cx="17" cy="31" r="7.5" fill="#f2c9a0" />
      <path d="M11.5 26.5 L15.5 29 M22.5 26.5 L18.5 29" stroke="#3b2a1a" strokeWidth="1.8" />
      <circle cx="14.4" cy="31.2" r="1" fill="#3b2a1a" />
      <circle cx="19.6" cy="31.2" r="1" fill="#3b2a1a" />
      <path d="M14 35.8 Q17 33.2 20 35.8" stroke="#3b2a1a" strokeWidth="1.5" />
      <path d="M38 48 C38 39 58 39 58 48 Z" fill="#dc2626" />
      <path d="M41 42 L40 25" stroke="#dc2626" strokeWidth="3.4" />
      <circle cx="48" cy="31" r="7.5" fill="#f2c9a0" />
      <path d="M42.5 26.5 L46.5 29 M53.5 26.5 L49.5 29" stroke="#3b2a1a" strokeWidth="1.8" />
      <circle cx="45.4" cy="31.2" r="1" fill="#3b2a1a" />
      <circle cx="50.6" cy="31.2" r="1" fill="#3b2a1a" />
      <path d="M45 35.8 Q48 33.2 51 35.8" stroke="#3b2a1a" strokeWidth="1.5" />
      <path d="M69 48 C69 39 89 39 89 48 Z" fill="#2563eb" />
      <path d="M86 42 L89 27" stroke="#2563eb" strokeWidth="3.4" />
      <circle cx="79" cy="31" r="7.5" fill="#f2c9a0" />
      <path d="M73.5 26.5 L77.5 29 M84.5 26.5 L80.5 29" stroke="#3b2a1a" strokeWidth="1.8" />
      <circle cx="76.4" cy="31.2" r="1" fill="#3b2a1a" />
      <circle cx="81.6" cy="31.2" r="1" fill="#3b2a1a" />
      <path d="M76 35.8 Q79 33.2 82 35.8" stroke="#3b2a1a" strokeWidth="1.5" />
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
