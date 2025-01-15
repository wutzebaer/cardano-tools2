"use client";
import React, { useContext } from "react";
import { ApplicationContext } from "@/app/StateProvider";
import { listWallets } from "@cardano/wallet";
import WalletDropdown from "./WalletDialog";

const StakeNow = () => {
  const context = useContext(ApplicationContext);

  const logWallets = () => {
    const wallets = listWallets();
    console.log(wallets);
    context.setState({ count: context.state.count + 1 });
  };

  return (
    <>
      <button
        className="btn btn-sm btn-primary"
        onClick={() => (document.getElementById("my_modal_1") as HTMLFormElement).showModal()}
      >
        Stake Now! {context.state.count}
      </button>
    </>
  );
};

export default StakeNow;
