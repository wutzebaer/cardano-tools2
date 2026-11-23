import { PageHeader } from "@components/ui";
import { Suspense } from "react";
import MyTokens from "./MyTokens";

export default function Page() {
  return (
    <>
      <PageHeader title="My tokens" art="tokens">Tokens held by your wallet or any address</PageHeader>
      <Suspense>
        <MyTokens />
      </Suspense>
    </>
  );
}
