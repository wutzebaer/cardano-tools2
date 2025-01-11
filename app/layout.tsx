import type { Metadata } from "next";
import { Geist, Geist_Mono, Quicksand } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import { CircleStackIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import StakeNow from "./components/StakeNow";

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

function MenuItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-lg">
      <a className="flex items-center">{children}</a>
    </li>
  );
}

export default function RootLayout({}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${quicksand.variable} antialiased`}
      >
        {/* <FIrstTry>{children}</FIrstTry> */}

        <div className="drawer lg:drawer-open">
          <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
          <div className="drawer-content flex flex-col items-center justify-center">
            {/* Page content here */}
            <label
              htmlFor="my-drawer-2"
              className="btn btn-primary drawer-button lg:hidden"
            >
              Open drawer
            </label>
          </div>
          <div className="drawer-side">
            {/* backdrop for open drawer on mobile */}
            <label
              htmlFor="my-drawer-2"
              aria-label="close sidebar"
              className="drawer-overlay"
            ></label>

            {/* Sidebar content */}
            <ul className="menu bg-base-200 text-base-content min-h-full w-80">
              {/* Sidebar header */}
              <h1 className="text-3xl font-bold font-[family-name:var(--font-quicksand)] flex items-center gap-x-2 p-4 mb-20">
                <Image
                  className="invert"
                  src="/cardano-tools-logo.svg"
                  alt="Cardano logo"
                  width={50}
                  height={50}
                  priority
                />
                <span>Cardano Tools</span>
              </h1>

              {/* Sidebar items */}
              <MenuItem>
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
              <MenuItem>
                <GlobeAltIcon className="h-7" /> Browse
              </MenuItem>
              <MenuItem>
                <CircleStackIcon className="h-7" /> Mint
              </MenuItem>

              {/* Sidebar footer */}
              <div className="flex flex-col items-center mt-20">
                <Image
                  src="/charlien-t.png"
                  alt="CHIEN logo"
                  width={180}
                  height={180}
                />
                <StakeNow />
              </div>
            </ul>
          </div>
        </div>
      </body>
    </html>
  );
}
