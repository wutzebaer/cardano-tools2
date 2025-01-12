"use client";
import React from "react";
import { WalletInfo } from "@types";

const StakeNow = () => {
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
  };

  return (
    <button className="btn btn-sm btn-primary" onClick={logWallets}>
      Stake Now!
    </button>
  );
};

export default StakeNow;
