"use client";

import { delegateToPool } from "@cardano/transaction";
import { getConnection } from "@cardano/wallet";
import { useContext } from "react";
import { ApplicationContext } from "../StateProvider";
import Image from "next/image";

const StakeNow = () => {
  const context = useContext(ApplicationContext);

  const stake = async () => {
    const poolId = "pool180fejev4xgwe2y53ky0pxvgxr3wcvkweu6feq5mdljfzcsmtg6u";
    const connection = await getConnection(true);
    delegateToPool(connection, poolId);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Image
        src="/charlien-t.png"
        alt="CHIEN logo"
        width={150}
        height={150}
      />
      <button className="btn btn-ghost w-full" onClick={stake}>
        Stake Now!
      </button>
    </div>
  );
};

export default StakeNow;
