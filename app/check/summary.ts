import { shortenId } from "@cardano/utils";
import { cache } from "react";
import { loadCheck } from "./loadCheck";

/** The page, its metadata and its preview image ask for the same check, one request serves them all. */
export const load = cache(loadCheck);

/** One line for link previews: where the address stakes and what stands out, no balances. */
export async function checkSummary(input: string) {
  const data = await load(input);
  const name = input.startsWith("$") ? input.toLowerCase() : shortenId(input, 8);
  if ("error" in data) return { name, summary: data.error };
  const { check, findings } = data;
  if (!check) return { name, summary: "This address has never been used." };
  if (!check.registered || !check.pool) return { name, summary: "This address is not staking." };
  const pool = check.pool.ticker ? `[${check.pool.ticker}]` : "a pool without a name";
  const top = findings[0];
  const vote = check.drepId ? "" : " The governance vote is not delegated.";
  return { name, summary: `Staked with ${pool}. ${top?.level === "ok" ? "Nothing stands out about the pool." : `${top?.title}.`}${vote}` };
}
