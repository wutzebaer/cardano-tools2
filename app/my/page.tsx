import { PageHeader } from "@components/ui";
import MyTokens from "./MyTokens";

export default function Page() {
  return (
    <>
      <PageHeader title="My tokens">Tokens held by your wallet or any address</PageHeader>
      <MyTokens />
    </>
  );
}
