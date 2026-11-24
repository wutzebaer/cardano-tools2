"use client";

import { EMPTY_WALLETS, listWallets } from "@cardano/wallet";
import Image from "next/image";
import { useSyncExternalStore } from "react";

/** Wallets suggested to a visitor who has none installed, in the order they are shown. */
const INSTALLABLE = [
  { name: "Lace", href: "https://www.lace.io/" },
  { name: "Eternl", href: "https://eternl.io/" },
];

const subscribe = () => () => {};

let clientWallets: ReturnType<typeof listWallets> | undefined;
const getClientWallets = () => (clientWallets ??= listWallets());
const getServerWallets = () => EMPTY_WALLETS;

function WalletDialog() {
  const wallets = useSyncExternalStore(
    subscribe,
    getClientWallets,
    getServerWallets,
  );

  return (
    <dialog id="wallet_dialog" className="modal">
      <div className="modal-box surface">
        <h2 className="text-brand text-xl font-semibold tracking-tight">
          Select your wallet
        </h2>
        <p className="mt-1 text-sm text-base-content/55">
          Connect a CIP-30 compatible browser wallet.
        </p>
        <form method="dialog">
          <div className="flex flex-col gap-2 py-5">
            {[...wallets.entries()].length > 0 ? (
              [...wallets.entries()].map(([key, value]) => (
                <button
                  key={key}
                  className="btn justify-start gap-3 border-line bg-base-300 hover:border-line-strong hover:bg-base-300"
                  value={key}
                >
                  <Image
                    width={24}
                    height={24}
                    src={value.icon}
                    alt={`${value.name} logo`}
                    className="size-6 rounded-full"
                    unoptimized
                  />
                  <span className="font-medium">{value.name}</span>
                </button>
              ))
            ) : (
              <div className="text-sm text-base-content/70">
                <p>No wallets found. Please install a Cardano wallet:</p>
                <ul className="mt-2 list-inside list-disc pl-2">
                  {INSTALLABLE.map((wallet) => (
                    <li key={wallet.href}>
                      <a
                        href={wallet.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary"
                      >
                        {wallet.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </form>
        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-ghost" value="">
              Close
            </button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button value="">close</button>
      </form>
    </dialog>
  );
}

export default WalletDialog;
