import { PageHeader } from "@components/ui";
import BurnTokens from "./BurnTokens";

export default function Page() {
  return (
    <>
      <PageHeader title="Burn" art="burn">Burn tokens of your own policies, as long as the policy is not locked</PageHeader>
      <BurnTokens />
    </>
  );
}
