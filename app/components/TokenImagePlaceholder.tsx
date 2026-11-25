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

export default function TokenImagePlaceholder({ royalty }: { royalty?: boolean }) {
    return (
        <div className="flex aspect-square w-full items-center justify-center bg-base-300">
            {royalty ? (
                <RoyaltyArt />
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
