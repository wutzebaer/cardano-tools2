"use client";
import Image from "next/image";
import { listWallets } from "../cardano/wallet";
import { WalletInfo } from "../types";

function WalletDialog() {
  const wallets = listWallets();

  const selectWallet = (wallet: WalletInfo) => {
    wallet.enable();
  };

  return (
    <dialog id="wallet_dialog" className="modal">
      <div className="modal-box">
        <p className="py-4">Please select your wallet</p>
        <div className="flex flex-col gap-2 py-4">
          {wallets.map((wallet) => (
            <button key={wallet.name} className="btn btn-md" onClick={() => selectWallet(wallet)}>
              <img
                width="24"
                height="24"
                src={wallet.icon}
                alt="{wallet.name} logo"
              />
              {wallet.name}
            </button>
          ))}
        </div>
        <div className="modal-action">
          <form method="dialog">
            {/* if there is a button in form, it will close the modal */}
            <button className="btn">Close</button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}

export default WalletDialog;
