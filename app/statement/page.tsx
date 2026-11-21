import { PageHeader } from "@components/ui";
import WalletStatement from "./WalletStatement";

export default function Page() {
  return (
    <>
      <PageHeader title="Wallet statement">Every transaction and staking reward of a wallet with its value at the time, e.g. for your tax return</PageHeader>
      <WalletStatement />
    </>
  );
}
