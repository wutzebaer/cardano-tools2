import { PageHeader } from "@components/ui";
import type { Metadata } from "next";
import TaxReport from "./TaxReport";

export const metadata: Metadata = {
  title: "Staking rewards report",
  description: "Cardano staking rewards per epoch with their EUR or USD value on the day of the payout, totals per year, as CSV or PDF.",
};

export default function Page() {
  return (
    <>
      <PageHeader title="Staking rewards report" art="statement">
        Every staking reward with its value on the day it was paid out and the total per year, e.g. for your tax return
      </PageHeader>
      <TaxReport />
    </>
  );
}
