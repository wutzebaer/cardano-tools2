"use client";
import { useEffect, useState } from "react";
import { listWallets } from "../cardano/wallet";
import { Cardano } from "../types";

function WalletDialog() {

  const [wallets, setWallets] = useState<Cardano>(new Map());
  useEffect(() => {
    const fetchedWallets = listWallets(); // Your function to list wallets
    setWallets(fetchedWallets); // Update the state with the fetched wallets
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <dialog id="wallet_dialog" className="modal">
      <div className="modal-box">
        <p className="py-4">Please select your wallet</p>
        <form method="dialog">
          <div className="flex flex-col gap-2 py-4">
            {[...wallets.entries()].map(([key, value]) => (
              <button key={key} className="btn btn-md" value={key}>
                <img
                  width="24"
                  height="24"
                  src={value.icon}
                  alt="{wallet.name} logo"
                />
                {value.name}
              </button>
            ))}
          </div>
        </form>
        <div className="modal-action">
          <form method="dialog">
            {/* if there is a button in form, it will close the modal */}
            <button className="btn" value="">
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
