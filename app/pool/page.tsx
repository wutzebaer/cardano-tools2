import { POOL_ID, POOL_TICKER, TELEGRAM_URL } from "@cardano/pool";
import { IS_MAINNET, NETWORK } from "@cardano/network";
import { ExternalLink, Notice, PageHeader } from "@components/ui";
import PoolStake from "./PoolStake";

export default function Page() {
  return (
    <>
      <PageHeader title={`[${POOL_TICKER}] Pool`}>Cardano Tools, the stake pool that runs and finances this site</PageHeader>

      <div className="flex flex-col gap-6">
        {IS_MAINNET ? <PoolStake /> : <Notice>The [{POOL_TICKER}] pool runs on mainnet. This instance works on the {NETWORK.name} testnet, delegation is not offered here.</Notice>}

        <div className="flex max-w-3xl flex-col gap-3 text-[15px] leading-relaxed text-base-content/65">
          <p>
            The pool started in 2020 as EURO pool, out of curiosity for the Cardano blockchain. After getting more and more excited about the tech, cardano-tools.io was
            created to help others use the advantages of Cardano without hacking the console. Its features are continuously extended and improved with the help of the
            community.
          </p>
          <p>
            For some years the pool carried the name of the Charly &amp; Aliens alliance, ticker CHIEN. Since November 2026 it is named after what it stands for:
            Cardano Tools, ticker {POOL_TICKER}. It is the same pool with the same operator and the same pool id, delegators do not have to do anything.
          </p>
          <p className="text-base-content">
            An independent single pool with 0% margin, the minimum fixed fee and more than 50,000 ADA pledge, on a dedicated server in Germany. Staking with [
            {POOL_TICKER}] supports the further development of Cardano Tools and helps cover its running costs.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ExternalLink href={`https://cexplorer.io/pool/${POOL_ID}`}>cexplorer</ExternalLink>
            <ExternalLink href={TELEGRAM_URL}>Telegram</ExternalLink>
          </div>
        </div>

        <div className="surface overflow-hidden">
          <iframe
            title="Cardano Tools pool dashboard"
            className="h-[1000px] w-full"
            loading="lazy"
            src="https://dashboard.cardano-tools.io/d/Tkk24NwMk/cardano-tools-pool?orgId=1&refresh=5s"
          />
        </div>
      </div>
    </>
  );
}
