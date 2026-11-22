import { IS_MAINNET, NETWORK } from "@cardano/network";
import { POOL_ID, POOL_TICKER, TELEGRAM_URL } from "@cardano/pool";
import CopyButton from "@components/CopyButton";
import { ExternalLink } from "@components/ui";
import { HeartIcon, LockOpenIcon, ServerStackIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { ReactNode } from "react";
import PoolStake from "./PoolStake";

/** The parameters the pool is registered with on chain. */
const FACTS = [
  { value: "0%", label: "Margin", detail: "The pool keeps no share of your rewards" },
  { value: "170 ₳", label: "Fixed fee per epoch", detail: "The lowest fee the protocol allows" },
  { value: "50,000+ ₳", label: "Pledge", detail: "The operator's own stake in the pool" },
  { value: "2021", label: "Minting blocks since", detail: "More than 570 blocks so far" },
];

const REASONS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <HeartIcon className="size-6" />,
    title: "It keeps the tools free",
    text: "Minting, burning, royalties, reward distribution and the wallet statement cost nothing. The pool pays for the server and the development behind them.",
  },
  {
    icon: <LockOpenIcon className="size-6" />,
    title: "Your ADA stays yours",
    text: "Delegating does not send or lock anything. Your ADA stays in your wallet, you can spend it at any time and switch pools whenever you like.",
  },
  {
    icon: <ServerStackIcon className="size-6" />,
    title: "An independent single pool",
    text: "One operator, one pool, on a dedicated server in Germany. Staking with small pools keeps Cardano decentralized.",
  },
];

const STEPS = [
  { title: "Connect your wallet", text: "Any CIP-30 wallet works, for example Eternl, Lace or Typhon." },
  { title: "Delegate", text: "Sign one transaction. The first delegation of a wallet takes a 2 ₳ deposit, which you get back when you stop staking." },
  { title: "Collect rewards", text: "The first rewards arrive after 15 to 20 days, then every 5 days. They are added to your stake automatically." },
];

export default function Page() {
  return (
    <div className="flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-box border border-line bg-linear-to-br from-[#070b1d] via-[#151a4a] to-[#2a1458] px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-xl flex-col gap-5">
            <p className="section-label text-accent">Stake pool [{POOL_TICKER}]</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
              Earn staking rewards. <span className="bg-linear-to-r from-accent via-primary to-[#a78bfa] bg-clip-text text-transparent">Keep Cardano Tools free.</span>
            </h1>
            <p className="text-base leading-relaxed text-white/70">
              Cardano Tools is run and paid for by its own stake pool. Delegate to [{POOL_TICKER}] and you earn the usual rewards, with 0% margin, while your stake keeps
              this site online.
            </p>
            {IS_MAINNET ? (
              <PoolStake />
            ) : (
              <p className="rounded-field border border-warning/40 bg-black/20 px-4 py-3 text-sm text-warning">
                The pool runs on mainnet. This instance works on the {NETWORK.name} testnet, delegation is not offered here.
              </p>
            )}
          </div>

          <Image
            src="/images/cardano-tools-pool-large.png"
            alt=""
            width={1024}
            height={1024}
            priority
            className="hidden size-56 shrink-0 rounded-full shadow-2xl shadow-black/50 ring-1 ring-white/15 lg:block xl:size-64"
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FACTS.map((fact) => (
          <div key={fact.label} className="surface flex flex-col gap-1 p-5">
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">{fact.value}</p>
            <p className="text-sm font-medium">{fact.label}</p>
            <p className="text-xs text-base-content/50">{fact.detail}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Why stake with [{POOL_TICKER}]</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {REASONS.map((reason) => (
            <div key={reason.title} className="surface flex flex-col gap-3 p-5">
              <div className="flex size-11 items-center justify-center rounded-field bg-primary/15 text-primary">{reason.icon}</div>
              <h3 className="font-semibold">{reason.title}</h3>
              <p className="text-sm leading-relaxed text-base-content/60">{reason.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">How staking works</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="surface flex gap-4 p-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/50 text-sm font-semibold text-primary">{index + 1}</span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-base-content/60">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-sm text-base-content/55">
          Prefer to delegate inside your wallet? Search for the ticker <span className="font-mono text-base-content">{POOL_TICKER}</span> or use the pool id.
        </p>
        <div className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="section-label">Pool id</p>
            <p className="font-mono text-xs break-all text-base-content/80 sm:text-sm">{POOL_ID}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <CopyButton text={POOL_ID}>Copy</CopyButton>
            <ExternalLink href={`https://cexplorer.io/pool/${POOL_ID}`}>cexplorer</ExternalLink>
            <ExternalLink href={TELEGRAM_URL}>Telegram</ExternalLink>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">The story</h2>
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
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Live from the server</h2>
          <p className="mt-1 text-sm text-base-content/55">Nothing to hide: this is the monitoring dashboard of the block producer.</p>
        </div>
        <div className="surface overflow-hidden">
          <iframe
            title="Cardano Tools pool dashboard"
            className="h-[1000px] w-full"
            loading="lazy"
            src="https://dashboard.cardano-tools.io/d/Tkk24NwMk/cardano-tools-pool?orgId=1&refresh=5s"
          />
        </div>
      </section>
    </div>
  );
}
