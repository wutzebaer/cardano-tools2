"use client";
import { getConnection } from '../cardano/wallet';

function WalletInfo() {

  const connection = getConnection();

  return (
    <div>
      WALLET
    </div>
  )
}

export default WalletInfo
