import type { TechnicalToken } from "@cardano/technicalToken";
import Image from "next/image";

/** The picture of a CIP-27 royalty token, which has none of its own: a coin with the share that goes back to the creator. */
function RoyaltyArt() {
    return (
        <svg viewBox="0 0 200 200" className="w-3/5" role="img" aria-label="Royalty token">
            <defs>
                <linearGradient id="royalty-coin" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fbbf24" />
                    <stop offset="1" stopColor="#f97316" />
                </linearGradient>
            </defs>
            {/* the share on its way back to the creator */}
            <path d="M100 14a86 86 0 1 1-74.5 43" fill="none" stroke="url(#royalty-coin)" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 13" opacity="0.7" />
            <path d="M12 60l14-4 4 15" fill="none" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
            <circle cx="100" cy="100" r="62" fill="url(#royalty-coin)" opacity="0.16" />
            <circle cx="100" cy="100" r="62" fill="none" stroke="url(#royalty-coin)" strokeWidth="5" />
            <circle cx="100" cy="100" r="50" fill="none" stroke="url(#royalty-coin)" strokeWidth="2" opacity="0.5" />
            {/* percent sign */}
            <g stroke="url(#royalty-coin)" strokeWidth="9" strokeLinecap="round" fill="none">
                <line x1="124" y1="74" x2="76" y2="126" />
                <circle cx="80" cy="82" r="10" />
                <circle cx="120" cy="118" r="10" />
            </g>
        </svg>
    );
}

/** The picture of a group of a drop: the tokens it keeps for sale as tiles, some of them already gone. */
function GroupArt() {
    const sold = new Set([1, 5, 6]);
    return (
        <svg viewBox="0 0 200 200" className="w-3/5" role="img" aria-label="Group of a drop">
            <defs>
                <linearGradient id="drop-group" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#38bdf8" />
                    <stop offset="1" stopColor="#818cf8" />
                </linearGradient>
            </defs>
            {Array.from({ length: 9 }, (_, index) => {
                const x = 34 + (index % 3) * 46;
                const y = 34 + Math.floor(index / 3) * 46;
                return sold.has(index) ? (
                    <rect key={index} x={x} y={y} width="40" height="40" rx="8" fill="none" stroke="url(#drop-group)" strokeWidth="3" strokeDasharray="5 6" opacity="0.5" />
                ) : (
                    <g key={index}>
                        <rect x={x} y={y} width="40" height="40" rx="8" fill="url(#drop-group)" opacity="0.18" />
                        <rect x={x} y={y} width="40" height="40" rx="8" fill="none" stroke="url(#drop-group)" strokeWidth="4" />
                    </g>
                );
            })}
        </svg>
    );
}

/** The picture of a CIP-68 reference NFT: the sheet the metadata of a token is written on. */
function ReferenceArt() {
    return (
        <svg viewBox="0 0 200 200" className="w-3/5" role="img" aria-label="Metadata of a token">
            <defs>
                <linearGradient id="reference-sheet" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#34d399" />
                    <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
            </defs>
            <path d="M56 28h62l32 32v108a8 8 0 0 1-8 8H56a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z" fill="url(#reference-sheet)" opacity="0.14" />
            <path d="M56 28h62l32 32v108a8 8 0 0 1-8 8H56a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z" fill="none" stroke="url(#reference-sheet)" strokeWidth="5" strokeLinejoin="round" />
            <path d="M118 28v32h32" fill="none" stroke="url(#reference-sheet)" strokeWidth="5" strokeLinejoin="round" />
            <g stroke="url(#reference-sheet)" strokeWidth="6" strokeLinecap="round" opacity="0.8">
                <line x1="68" y1="92" x2="130" y2="92" />
                <line x1="68" y1="116" x2="130" y2="116" />
                <line x1="68" y1="140" x2="108" y2="140" />
            </g>
        </svg>
    );
}

const ART = { royalty: RoyaltyArt, group: GroupArt, reference: ReferenceArt };

/** What stands in for a token without a picture: its kind drawn for the technical ones, the logo of the site for the rest. */
export default function TokenImagePlaceholder({ royalty, kind }: { royalty?: boolean; kind?: TechnicalToken["kind"] }) {
    const Art = kind ? ART[kind] : royalty ? RoyaltyArt : null;
    return (
        <div className="flex aspect-square w-full items-center justify-center bg-base-300">
            {Art ? (
                <Art />
            ) : (
                <Image
                    src="/images/cardano-tools-logo.svg"
                    alt=""
                    width={577}
                    height={524}
                    className="w-2/5 opacity-50"
                />
            )}
        </div>
    );
}
