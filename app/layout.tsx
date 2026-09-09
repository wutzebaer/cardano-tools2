import { SparklesIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import ErrorBoundary from "@components/ErrorBoundary";
import ErrorToast from "@components/ErrorToast";
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
  description: "Browse, mint, and stake on Cardano",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <ErrorToast />
        <WalletDialog />
        <StateProvider>
          <div className="drawer lg:drawer-open">
            <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content flex min-h-dvh flex-col">
              <Navbar />
              <main className="mx-auto w-full max-w-6xl flex-grow px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
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
                  <NavLink href="/mint" icon={<SparklesIcon className="size-5" />}>
                    Mint
                  </NavLink>
                  <NavLink
                    href="/pool"
                    icon={
                      <Image
                        className="size-5 rounded-full object-cover"
                        src="/images/charlien-t-xs.png"
                        alt="CHIEN logo"
                        priority
                        width={20}
                        height={20}
                      />
                    }
                  >
                    [CHIEN] Pool
                  </NavLink>
                </nav>

                <div className="flex-grow"></div>

                <div className="flex flex-col gap-3">
                  <StakeNow />
                  <WalletOverview />
                </div>
              </aside>
            </div>
          </div>
        </StateProvider>
      </body>
    </html>
  );
}
