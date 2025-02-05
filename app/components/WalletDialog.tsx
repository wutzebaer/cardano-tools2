"use client";
import { useEffect, useState } from "react";
import { listWallets } from "../cardano/wallet";
import { Cardano } from "../cardano/types";

function WalletDialog() {
  const [wallets, setWallets] = useState<Cardano>(new Map());
  useEffect(() => {
    const fetchedWallets = listWallets(); // Your function to list wallets
    setWallets(fetchedWallets); // Update the state with the fetched wallets
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <dialog id="wallet_dialog" className="modal">
      <div className="modal-box">
        <h2 className="text-2xl font-bold mb-4">Select Your Wallet</h2>
        <form method="dialog">
          <div className="flex flex-col gap-4 py-4">
            {[...wallets.entries()].length > 0 ? (
              [...wallets.entries()].map(([key, value]) => (
                <button
                  key={key}
                  className="btn btn-md flex items-center gap-2 p-2 border rounded-md hover:bg-gray-100"
                  value={key}
                >
                  <img
                    width="24"
                    height="24"
                    src={value.icon}
                    alt={`${value.name} logo`}
                    className="rounded-full"
                  />
                  <span className="font-medium">{value.name}</span>
                </button>
              ))
            ) : (
              <div>
                <p>No wallets found. Please install a Cardano wallet:</p>
                <ul className="list-disc list-inside pl-4">
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
            <button className="btn btn-secondary" value="">
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
