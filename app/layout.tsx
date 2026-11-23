import { NavigationTracker } from "@components/BackToBrowse";
import ErrorBoundary from "@components/ErrorBoundary";
import ErrorToast from "@components/ErrorToast";
import { IS_MAINNET, NETWORK } from "@cardano/network";
import { POOL_TICKER, TELEGRAM_URL } from "@cardano/pool";
import { BanknotesIcon, DocumentTextIcon, FireIcon, GiftIcon, IdentificationIcon, SparklesIcon, Squares2X2Icon, WalletIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import packageJson from "../package.json";
import Navbar from "./components/Navbar";
import NavLink from "./components/NavLink";
import SidebarHeader from "./components/SidebarHeader";
import StakeNow from "./components/StakeNow";
import StateProvider from "./components/StateProvider";
import WalletDialog from "./components/WalletDialog";
import WalletOverview from "./components/WalletOverview";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cardano Tools",
  description: "Browse, mint and burn tokens, reward your stakers and create wallet statements on Cardano, straight from your wallet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <NavigationTracker />
        <ErrorToast />
        <WalletDialog />
        <StateProvider>
          <div className="drawer lg:drawer-open">
            <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content flex min-h-dvh flex-col">
              <Navbar />
              <main className="mx-auto w-full max-w-6xl grow px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <div className="drawer-side z-40">
              <label htmlFor="my-drawer-2" aria-label="close sidebar" className="drawer-overlay"></label>

              <aside className="flex min-h-full w-72 flex-col gap-8 border-r border-line bg-base-100 p-4">
                <SidebarHeader />

                <nav className="flex flex-col gap-1">
                  <p className="section-label mb-2 px-3">Tools</p>
                  <NavLink href="/browse" icon={<Squares2X2Icon className="size-5" />}>
                    Browse
                  </NavLink>
                  <NavLink href="/my" icon={<WalletIcon className="size-5" />}>
                    My tokens
                  </NavLink>
                  <NavLink href="/mint" icon={<SparklesIcon className="size-5" />}>
                    Mint
                  </NavLink>
                  <NavLink href="/royalties" icon={<BanknotesIcon className="size-5" />}>
                    Royalties
                  </NavLink>
                  <NavLink href="/burn" icon={<FireIcon className="size-5" />}>
                    Burn
                  </NavLink>
                  <NavLink href="/register" icon={<IdentificationIcon className="size-5" />}>
                    Register token
                  </NavLink>
                  <NavLink href="/rewards" icon={<GiftIcon className="size-5" />}>
                    Reward stakers
                  </NavLink>
                  <NavLink href="/statement" icon={<DocumentTextIcon className="size-5" />}>
                    Wallet statement
                  </NavLink>
                  <NavLink
                    href="/pool"
                    icon={
                      <Image
                        className="size-5 rounded-full object-cover"
                        src="/images/cardano-tools-pool.png"
                        alt=""
                        priority
                        width={20}
                        height={20}
                      />
                    }
                  >
                    [{POOL_TICKER}] Pool
                  </NavLink>
                </nav>

                <div className="grow"></div>

                <div className="flex flex-col gap-3">
                  {IS_MAINNET ? (
                    <StakeNow />
                  ) : (
                    <p className="rounded-field border border-warning/40 px-3 py-2 text-center text-xs text-warning">{NETWORK.name} testnet</p>
                  )}
                  <WalletOverview />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-base-content/45">
                    <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-base-content">
                      Contact
                    </a>
                    <a href="https://github.com/wutzebaer/cardano-tools2" target="_blank" rel="noopener noreferrer" className="hover:text-base-content">
                      GitHub
                    </a>
                    <Link href="/legal/terms" className="hover:text-base-content">
                      Terms
                    </Link>
                    <Link href="/legal/privacy" className="hover:text-base-content">
                      Privacy
                    </Link>
                    <Link href="/legal/imprint" className="hover:text-base-content">
                      Imprint
                    </Link>
                    <span title="Version">v{packageJson.version}</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </StateProvider>
      </body>
    </html>
  );
}
