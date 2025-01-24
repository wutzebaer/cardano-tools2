"use client";

import { getWalletInfo } from "@cardano/wallet";
import { WalletInfo } from "@types";
import { useEffect, useState } from "react";

function WalletOverview() {

  const [connection, setConnection] = useState<WalletInfo | null>(null);

  // Get wallet info
  useEffect(() => {
    (async () => {
      setConnection(await getWalletInfo(false));
    })();
  }, []);


  return (
    <div>
      {connection?.name}
    </div>
  )
}

export default WalletOverview
