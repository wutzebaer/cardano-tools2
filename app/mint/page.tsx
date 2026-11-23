import { PageHeader } from "@components/ui";
import MintForm from "./MintForm";

export default function Page() {
  return (
    <>
      <PageHeader title="Mint" art="mint">
        Mint CIP-68 NFTs and fungible tokens directly from your wallet
      </PageHeader>
      <MintForm />
    </>
  );
}
