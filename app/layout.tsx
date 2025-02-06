import { CircleStackIcon } from "@heroicons/react/24/outline";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Quicksand } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import StakeNow from "./components/StakeNow";
import "./globals.css";
import StateProvider from "./components/StateProvider";
import WalletDialog from "./components/WalletDialog";
import SidebarHeader from "./components/SidebarHeader";
import Navbar from "./components/Navbar";
import WalletOverview from "./components/WalletOverview";
import ErrorToast from "@components/ErrorToast";
import ErrorBoundary from "@components/ErrorBoundary";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Cardano Tools",
  description: "Generated by create next app",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${quicksand.variable} antialiased`}
      >
        <ErrorToast />
        <WalletDialog />
        <StateProvider>
          <div className="drawer lg:drawer-open">
            <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
            <div className="drawer-content min-h-dvh flex flex-col">
              {/* Navbar */}
              <Navbar />
              {/* Main content */}
              <main className="my-14 flex-grow mx-4 sm:mx-14">
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
            <div className="drawer-side">
              {/* backdrop for open drawer on mobile */}
              <label
                htmlFor="my-drawer-2"
                aria-label="close sidebar"
                className="drawer-overlay"
              ></label>

              {/* Sidebar content */}
              <ul className="menu bg-base-200 text-base-content min-h-full w-80 gap-2">

                {/* Sidebar header */}
                <SidebarHeader />

                {/* Sidebar items */}
                <MenuItem href="/pool">
                  <Image
                    className="rounded-btn"
                    src="/charlien-t.png"
                    alt="CHIEN logo"
                    priority
                    width={28}
                    height={28}
                  />
                  <span>[CHIEN] Pool</span>
                </MenuItem>
                <MenuItem href="/browse">
                  <CircleStackIcon className="h-7" /> Browse
                </MenuItem>
                <MenuItem href="/mint">
                  <CircleStackIcon className="h-7" /> Mint
                </MenuItem>
                <MenuItem href="/sample">
                  <CircleStackIcon className="h-7" /> sample
                </MenuItem>

                {/* Sidebar footer */}
                <div className="mt-20">
                  <StakeNow />
                </div>

                <div className="flex-grow"></div> {/* Spacer to push WalletOverview to the bottom */}
                <WalletOverview />
              </ul>

            </div>
          </div>
        </StateProvider>
      </body>
    </html>
  );
}
