import { CircleStackIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import ErrorBoundary from "@components/ErrorBoundary";
import ErrorToast from "@components/ErrorToast";
import Navbar from "./components/Navbar";
import SidebarHeader from "./components/SidebarHeader";
import StakeNow from "./components/StakeNow";
import StateProvider from "./components/StateProvider";
import WalletDialog from "./components/WalletDialog";
import WalletOverview from "./components/WalletOverview";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Cardano Tools",
  description: "Browse, mint, and stake on Cardano",
};

function MenuItem({
  children,
  href,
}: Readonly<{
  children: React.ReactNode;
  href: string;
}>) {
  return (
    <li className="text-lg">
      <Link href={href} className="flex items-center">
        {children}
      </Link>
    </li>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${quicksand.variable} antialiased`}>
        <ErrorToast />
        <WalletDialog />
        <StateProvider>
          <div className="drawer lg:drawer-open">
            <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content min-h-dvh flex flex-col">
              <Navbar />
              <main className="my-14 flex-grow mx-4 sm:mx-14">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <div className="drawer-side">
              <label
                htmlFor="my-drawer-2"
                aria-label="close sidebar"
                className="drawer-overlay"
              ></label>

              <ul className="menu bg-base-200 text-base-content min-h-full w-80 gap-2">
                <SidebarHeader />

                <MenuItem href="/pool">
                  <Image
                    className="rounded-btn"
                    src="/charlien-t-xs.png"
                    alt="CHIEN logo"
                    priority
                    width={28}
                    height={33}
                  />
                  <span>[CHIEN] Pool</span>
                </MenuItem>
                <MenuItem href="/browse">
                  <CircleStackIcon className="h-7" /> Browse
                </MenuItem>
                <MenuItem href="/mint">
                  <CircleStackIcon className="h-7" /> Mint
                </MenuItem>

                <div className="mt-20">
                  <StakeNow />
                </div>

                <div className="flex-grow"></div>
                <WalletOverview />
              </ul>
            </div>
          </div>
        </StateProvider>
      </body>
    </html>
  );
}
