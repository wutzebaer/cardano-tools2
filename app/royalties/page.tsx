import { PageHeader } from "@components/ui";
import RoyaltiesForm from "./RoyaltiesForm";

export default function Page() {
  return (
    <>
      <PageHeader title="Royalties">Define royalties for a policy with a CIP-27 royalty token</PageHeader>
      <RoyaltiesForm />
    </>
  );
}
