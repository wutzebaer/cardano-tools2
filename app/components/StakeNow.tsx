"use client";

import { delegateToPool } from "@cardano/transaction";
import { getConnection } from "@cardano/wallet";
import { useContext } from "react";
import { ApplicationContext } from "../StateProvider";

const StakeNow = () => {
  const context = useContext(ApplicationContext);

  const stake = async () => {
    const poolId = "pool180fejev4xgwe2y53ky0pxvgxr3wcvkweu6feq5mdljfzcsmtg6u";
    const connection = await getConnection(true);
    delegateToPool(connection, poolId);
  };

  return (
    <>
      <button className="btn btn-sm btn-primary" onClick={stake}>
        Stake Now! {context.state.count}
      </button>
    </>
  );
};

export default StakeNow;
