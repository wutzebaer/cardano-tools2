import { PageHeader } from "@components/ui";
import type { Metadata } from "next";
import MoveWallet from "./MoveWallet";

export const metadata: Metadata = {
  title: "Move wallet",
  description: "Empty a Cardano wallet into a new one: all ADA and tokens in one go, with the staking deposit and rewards if you stop staking.",
};

export default function Page() {
  return (
    <>
      <PageHeader title="Move wallet" art="tokens">
        Send everything a wallet holds to a new address, tokens included, and stop staking on the way out
      </PageHeader>
      <MoveWallet />
    </>
  );
}
