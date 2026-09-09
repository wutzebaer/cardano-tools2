"use client";
import { useState } from "react";
import { listWallets } from "../cardano/wallet";
import { Cardano } from "../cardano/types";
import Image from "next/image";

function WalletDialog() {
  const [wallets, setWallets] = useState<Cardano>(new Map());

  return (
    <dialog
      id="wallet_dialog"
      className="modal"
      onToggle={() => setWallets(listWallets())}
    >
      <div className="modal-box surface">
        <h2 className="text-xl font-semibold tracking-tight">Select your wallet</h2>
        <p className="mt-1 text-sm text-base-content/55">Connect a CIP-30 compatible browser wallet.</p>
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
                    width="24"
                    height="24"
                    src={value.icon}
                    alt={`${value.name} logo`}
                    className="rounded-full"
                    unoptimized
                  />
                  <span className="font-medium">{value.name}</span>
                </button>
              ))
            ) : (
              <div className="text-sm text-base-content/70">
                <p>No wallets found. Please install a Cardano wallet:</p>
                <ul className="mt-2 list-inside list-disc pl-2">
                  <li>
                    <a
                      href="https://namiwallet.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary"
                    >
                      Nami Wallet
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://yoroi-wallet.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary"
                    >
                      Yoroi Wallet
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://eternl.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary"
                    >
                      Eternl Wallet
                    </a>
                  </li>
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
