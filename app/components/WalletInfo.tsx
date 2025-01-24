"use client";
import React, { useContext } from 'react'
import { ApplicationContext } from '../StateProvider';

function WalletInfo() {

    const context = useContext(ApplicationContext);

  return (
    <div>
      WALLET
    </div>
  )
}

export default WalletInfo
