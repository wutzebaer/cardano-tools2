import { PageHeader } from "@components/ui";
import type { Metadata } from "next";
import CheckForm from "./CheckForm";

export const metadata: Metadata = {
  title: "Staking check",
  description: "Check any Cardano address: is its stake pool active, retiring or saturated, what do its fees cost, is the choice about its voting rights made and are rewards waiting?",
};

const CHECKS: { title: string; text: string }[] = [
  { title: "Your stake pool", text: "Active, retiring or saturated? Blocks of the last epochs, the return next to the network average, margin and fixed fee." },
  { title: "Voting rights", text: "Cardano asks every staker to decide what happens with their vote before rewards can be withdrawn. The check shows whether that choice is still open." },
  { title: "Rewards", text: "What is waiting to be withdrawn, and roughly what the pool's fees cost you per year." },
  { title: "Alerts on Telegram", text: "After the check you can let a bot watch the address. It writes when the pool retires, stops making blocks or raises its fees." },
];

export default function Page() {
  return (
    <>
      <PageHeader title="Staking check" art="check">
        Enter any Cardano address and see whether its staking is in order: pool, fees, voting rights and rewards
      </PageHeader>
      <div className="flex flex-col gap-8">
        <CheckForm />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CHECKS.map((item) => (
            <li key={item.title} className="surface p-5">
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-base-content/65">{item.text}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-base-content/45">Nothing is stored. The check reads public chain data, and the link to a result can be shared.</p>
      </div>
    </>
  );
}
