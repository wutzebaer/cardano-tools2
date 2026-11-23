import { ImageResponse } from "next/og";
import { checkSummary } from "../summary";

export const alt = "Staking check on Cardano Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Preview image of a shared check: whose it is and the one line that sums it up. */
export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { name, summary } = await checkSummary(decodeURIComponent((await params).address));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#e6e8ee",
          background: "radial-gradient(circle at 85% 30%, rgba(52, 211, 153, 0.28), transparent 55%), radial-gradient(circle at 20% 100%, rgba(77, 124, 254, 0.3), transparent 55%), #0b0d11",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, color: "#8b93a7", letterSpacing: 4 }}>STAKING CHECK</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, backgroundImage: "linear-gradient(90deg, #22d3ee, #6f95ff, #a78bfa)", backgroundClip: "text", color: "transparent" }}>{name}</div>
          <div style={{ display: "flex", fontSize: 38, lineHeight: 1.35, color: "#c9cdd8" }}>{summary}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "#8b93a7" }}>
          <span>cardano-tools.io/check</span>
          <span>Pool · fees · governance vote · rewards</span>
        </div>
      </div>
    ),
    size
  );
}
