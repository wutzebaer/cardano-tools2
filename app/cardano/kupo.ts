import { components } from "@cardano/kupo.schema";

export const getTip = async () => {
  const checkpoints: components["schemas"]["Point"][] = await fetch(
    "http://localhost:1442/checkpoints",
    { next: { revalidate: 10 } }
  ).then((res) => res.json());
  return checkpoints[0].slot_no;
};

/* const data = await fetch(
    "http://localhost:1442/matches/*?created_after=" + tip + "&unspent"
  ).then((res) => res.json()); */
