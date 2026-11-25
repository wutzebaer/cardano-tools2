import { PageHeader } from "@components/ui";
import MintForm from "./MintForm";

export default function Page() {
  return (
    <>
      <PageHeader title="Mint" art="mint">
        Mint CIP-68 NFTs and fungible tokens from your wallet, or sell NFTs as a drop that mints each one when it is bought
      </PageHeader>
      <MintForm />
    </>
  );
}
