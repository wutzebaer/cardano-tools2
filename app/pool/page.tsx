import { CHIEN_POOL_ID, TELEGRAM_URL } from "@cardano/pool";
import { ExternalLink, PageHeader } from "@components/ui";
import PoolStake from "./PoolStake";

const PARTNERS = [
  { name: "$Charly", href: "https://charly-token.io/" },
  { name: "$WOLF", href: "https://wolfcardano.io/" },
  { name: "$PTC", href: "https://pockettowne.io/" },
];

export default function Page() {
  return (
    <>
      <PageHeader title="[CHIEN] Pool">The stake pool of the Charly &amp; Aliens alliance, which runs and finances Cardano Tools</PageHeader>

      <div className="flex flex-col gap-6">
        <PoolStake />

        <div className="flex max-w-3xl flex-col gap-3 text-[15px] leading-relaxed text-base-content/65">
          <p>
            The pool started in 2020 as EURO pool, out of curiosity for the Cardano blockchain. After getting more and more excited about the tech, cardano-tools.io was
            created to help others use the advantages of Cardano without hacking the console. Its features are continuously extended and improved with the help of the
            community.
          </p>
          <p>
            Later the community established the Charly project, which teamed up with the Aliens. Together they began supporting the pool and gave it a more fitting
            name: the Charly &amp; Aliens alliance, ticker CHIEN. For the sake of decentralization the $WOLF and $Charly communities give delegators an incentive with their
            tokens to switch from big pools to small pools like this one.
          </p>
          <p className="text-base-content">
            Stake with the Charly &amp; Aliens alliance to support the further development of Cardano Tools and help cover its running costs, and earn $Charly, $Alien,
            $WOLF and $PTC tokens along the way. They can be claimed on TosiDrop.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ExternalLink href={`https://cexplorer.io/pool/${CHIEN_POOL_ID}`}>cexplorer</ExternalLink>
            <ExternalLink href="https://app.tosidrop.io/cardano/claim">Claim on TosiDrop</ExternalLink>
            <ExternalLink href={TELEGRAM_URL}>Telegram</ExternalLink>
            {PARTNERS.map((partner) => (
              <ExternalLink key={partner.name} href={partner.href}>
                {partner.name}
              </ExternalLink>
            ))}
          </div>
        </div>

        <div className="surface overflow-hidden">
          <iframe title="[CHIEN] pool on cexplorer" className="h-80 w-full" loading="lazy" src={`https://img.cexplorer.io/w/widget.html?pool=${CHIEN_POOL_ID}&theme=dark`} />
        </div>

        <div className="surface overflow-hidden">
          <iframe
            title="[CHIEN] pool dashboard"
            className="h-[1000px] w-full"
            loading="lazy"
            src="https://dashboard.cardano-tools.io/d/Tkk24NwMk/euro-dashboard?orgId=1&refresh=5s"
          />
        </div>
      </div>
    </>
  );
}
