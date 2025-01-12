"use client";
import React, { useContext } from "react";
import { WalletInfo } from "@types";
import { SidebarContext } from "@/app/StateProvider";

const StakeNow = () => {
  const context = useContext(SidebarContext);

  const logWallets = () => {
    const cardano =
      // Convert the window.cardano object to an array of entries
      Object.entries(window.cardano ?? {})
        // Filter out wallets that don't have an API version
        .filter(([, value]: [string, WalletInfo]) => value.apiVersion)
        // Convert the array of entries to a Map
        .reduce((cardano, [key, value]) => {
          cardano.set(key, value);
          return cardano;
        }, new Map());
    console.log(cardano);
    context.setState({ count: context.state.count + 1 });
  };

  return (
    <button className="btn btn-sm btn-primary" onClick={logWallets}>
      Stake Now! {context.state.count}
    </button>
  );
};

export default StakeNow;
