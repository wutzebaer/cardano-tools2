import { PageHeader } from "@components/ui";
import type { Metadata } from "next";
import MoveWallet from "./MoveWallet";

export const metadata: Metadata = {
  title: "Close wallet",
  description: "Empty a Cardano wallet into a new one: all ADA and tokens in one go, with the staking deposit and rewards if you stop staking.",
};

export default function Page() {
  return (
    <>
      <PageHeader title="Close wallet" art="tokens">
        Give up a wallet: send everything it holds to a new address, tokens included, and stop staking on the way out
      </PageHeader>
      <MoveWallet />
    </>
  );
}
