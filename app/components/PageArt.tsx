import { ReactNode } from "react";

export type PageArtName = "mint" | "burn" | "timelock" | "rewards" | "statement" | "royalties" | "tokens" | "check" | "governance";

/** Four-pointed sparkle around a point. */
const sparkle = (x: number, y: number, size: number) =>
  `M${x} ${y - size}Q${x} ${y} ${x + size} ${y}Q${x} ${y} ${x} ${y + size}Q${x} ${y} ${x - size} ${y}Q${x} ${y} ${x} ${y - size}Z`;

/** Two colours per page and a line drawing of what the tool does, all in the 360 x 160 box of the banner's right side. */
const ART: Record<PageArtName, { from: string; to: string; drawing: (stroke: string, fill: string) => ReactNode }> = {
  mint: {
    from: "#4d7cfe",
    to: "#22d3ee",
    drawing: (stroke, fill) => (
      <>
        <circle cx="196" cy="104" r="27" stroke={stroke} strokeWidth="2" opacity="0.45" />
        <circle cx="252" cy="84" r="40" fill={fill} opacity="0.12" />
        <circle cx="252" cy="84" r="40" stroke={stroke} strokeWidth="2.5" />
        <circle cx="252" cy="84" r="30" stroke={stroke} strokeWidth="1.5" opacity="0.5" />
        <path d="M239 100l13-34 13 34M243 88h18M240 80h24" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={sparkle(312, 38, 15)} fill={fill} />
        <path d={sparkle(166, 46, 9)} fill={fill} opacity="0.7" />
        <path d={sparkle(322, 124, 8)} fill={fill} opacity="0.6" />
      </>
    ),
  },
  burn: {
    from: "#f97316",
    to: "#f87171",
    drawing: (stroke, fill) => (
      <>
        <path
          d="M252 22c20 30 50 45 40 82-5 26-28 40-46 40-24 0-46-17-44-44 1-18 14-27 18-45 12 10 16 22 16 31 10-17 18-40 16-64Z"
          fill={fill}
          opacity="0.12"
        />
        <path
          d="M252 22c20 30 50 45 40 82-5 26-28 40-46 40-24 0-46-17-44-44 1-18 14-27 18-45 12 10 16 22 16 31 10-17 18-40 16-64Z"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M248 96c10 12 17 23 10 36-5 9-18 10-24 1-6-9 0-21 14-37Z" fill={fill} opacity="0.75" />
        <circle cx="176" cy="60" r="3" fill={fill} opacity="0.7" />
        <circle cx="318" cy="48" r="4" fill={fill} opacity="0.6" />
        <circle cx="190" cy="28" r="2" fill={fill} opacity="0.5" />
        <circle cx="326" cy="96" r="2.5" fill={fill} opacity="0.5" />
      </>
    ),
  },
  timelock: {
    from: "#a78bfa",
    to: "#4d7cfe",
    drawing: (stroke, fill) => (
      <>
        <circle cx="250" cy="84" r="66" stroke={stroke} strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" opacity="0.5" />
        <circle cx="250" cy="84" r="66" stroke={stroke} strokeWidth="3" strokeDasharray="150 415" strokeLinecap="round" transform="rotate(-90 250 84)" />
        <rect x="216" y="76" width="68" height="54" rx="11" fill={fill} opacity="0.14" />
        <rect x="216" y="76" width="68" height="54" rx="11" stroke={stroke} strokeWidth="2.5" />
        <path d="M231 76V60a19 19 0 0 1 38 0v16" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="250" cy="98" r="6" fill={fill} />
        <path d="M250 102v12" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },
  rewards: {
    from: "#34d399",
    to: "#22d3ee",
    drawing: (stroke, fill) => (
      <>
        <path d="M250 82L186 38M250 82l72-40M250 82l80 34M250 82l-22 58M250 82l-74 38M250 82l46 56" stroke={stroke} strokeWidth="1.5" opacity="0.45" />
        <circle cx="250" cy="82" r="20" fill={fill} opacity="0.16" />
        <circle cx="250" cy="82" r="20" stroke={stroke} strokeWidth="2.5" />
        <path d="M243 91l7-19 7 19M245 85h10" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="186" cy="38" r="9" fill={fill} opacity="0.8" />
        <circle cx="322" cy="42" r="12" fill={fill} opacity="0.9" />
        <circle cx="330" cy="116" r="7" fill={fill} opacity="0.7" />
        <circle cx="228" cy="140" r="6" fill={fill} opacity="0.6" />
        <circle cx="176" cy="120" r="10" fill={fill} opacity="0.75" />
        <circle cx="296" cy="138" r="5" fill={fill} opacity="0.55" />
      </>
    ),
  },
  statement: {
    from: "#60a5fa",
    to: "#34d399",
    drawing: (stroke, fill) => (
      <>
        <path d="M176 134h160" stroke={stroke} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
        <rect x="188" y="104" width="18" height="30" rx="4" fill={fill} opacity="0.35" />
        <rect x="216" y="88" width="18" height="46" rx="4" fill={fill} opacity="0.5" />
        <rect x="244" y="98" width="18" height="36" rx="4" fill={fill} opacity="0.45" />
        <rect x="272" y="70" width="18" height="64" rx="4" fill={fill} opacity="0.7" />
        <rect x="300" y="50" width="18" height="84" rx="4" fill={fill} opacity="0.9" />
        <path d="M197 84l28-18 28 10 28-30 28-18" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="197" cy="84" r="4" fill={fill} />
        <circle cx="225" cy="66" r="4" fill={fill} />
        <circle cx="253" cy="76" r="4" fill={fill} />
        <circle cx="281" cy="46" r="4" fill={fill} />
        <circle cx="309" cy="28" r="4" fill={fill} />
      </>
    ),
  },
  royalties: {
    from: "#fbbf24",
    to: "#f97316",
    drawing: (stroke, fill) => (
      <>
        <circle cx="252" cy="82" r="64" stroke={stroke} strokeWidth="2" strokeDasharray="3 9" strokeLinecap="round" opacity="0.5" />
        <circle cx="252" cy="82" r="50" fill={fill} opacity="0.1" />
        <circle cx="226" cy="58" r="15" stroke={stroke} strokeWidth="3" />
        <circle cx="278" cy="106" r="15" stroke={stroke} strokeWidth="3" />
        <path d="M288 44l-72 76" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
        <path d={sparkle(326, 36, 10)} fill={fill} opacity="0.8" />
        <path d={sparkle(176, 128, 7)} fill={fill} opacity="0.6" />
      </>
    ),
  },
  tokens: {
    from: "#22d3ee",
    to: "#a78bfa",
    drawing: (stroke, fill) => (
      <>
        <rect x="186" y="42" width="66" height="88" rx="11" stroke={stroke} strokeWidth="2" opacity="0.5" transform="rotate(-12 219 86)" />
        <rect x="258" y="42" width="66" height="88" rx="11" stroke={stroke} strokeWidth="2" opacity="0.5" transform="rotate(12 291 86)" />
        <rect x="220" y="32" width="70" height="96" rx="12" fill="#12151b" />
        <rect x="220" y="32" width="70" height="96" rx="12" fill={fill} opacity="0.14" />
        <rect x="220" y="32" width="70" height="96" rx="12" stroke={stroke} strokeWidth="2.5" />
        <circle cx="255" cy="68" r="17" fill={fill} opacity="0.8" />
        <path d="M234 102h42M240 114h30" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
  },
  check: {
    from: "#34d399",
    to: "#4d7cfe",
    drawing: (stroke, fill) => (
      <>
        <path d="M246 22l52 18v40c0 32-22 54-52 64-30-10-52-32-52-64V40l52-18Z" fill={fill} opacity="0.12" />
        <path d="M246 22l52 18v40c0 32-22 54-52 64-30-10-52-32-52-64V40l52-18Z" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M222 82l17 17 32-36" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="318" cy="118" r="15" stroke={stroke} strokeWidth="2.5" />
        <path d="M329 129l13 13" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <path d={sparkle(172, 44, 8)} fill={fill} opacity="0.7" />
        <path d={sparkle(332, 46, 10)} fill={fill} opacity="0.8" />
      </>
    ),
  },
  governance: {
    from: "#a78bfa",
    to: "#22d3ee",
    drawing: (stroke, fill) => (
      <>
        <rect x="204" y="66" width="92" height="76" rx="10" fill={fill} opacity="0.12" />
        <rect x="204" y="66" width="92" height="76" rx="10" stroke={stroke} strokeWidth="2.5" />
        <path d="M232 82h36" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <rect x="226" y="20" width="48" height="58" rx="6" fill="#12151b" transform="rotate(8 250 49)" />
        <rect x="226" y="20" width="48" height="58" rx="6" stroke={stroke} strokeWidth="2.5" transform="rotate(8 250 49)" />
        <path d="M238 46l9 9 16-18" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(8 250 49)" />
        <path d={sparkle(326, 44, 10)} fill={fill} opacity="0.8" />
        <path d={sparkle(176, 108, 8)} fill={fill} opacity="0.65" />
        <path d={sparkle(322, 124, 6)} fill={fill} opacity="0.5" />
      </>
    ),
  },
};

export const pageArtColors = (name: PageArtName) => ({ from: ART[name].from, to: ART[name].to });

/** The drawing of a page, meant to fill the right side of its header banner. */
export default function PageArt({ name, className = "" }: { name: PageArtName; className?: string }) {
  const { from, to, drawing } = ART[name];
  const strokeId = `art-${name}-stroke`;
  const fillId = `art-${name}-fill`;
  return (
    <svg viewBox="150 0 200 160" fill="none" aria-hidden="true" className={className} preserveAspectRatio="xMaxYMid meet">
      <defs>
        <linearGradient id={strokeId} x1="160" y1="20" x2="340" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <linearGradient id={fillId} x1="340" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      {drawing(`url(#${strokeId})`, `url(#${fillId})`)}
    </svg>
  );
}
