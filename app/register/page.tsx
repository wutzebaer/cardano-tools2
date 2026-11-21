import { PageHeader } from "@components/ui";
import RegisterForm from "./RegisterForm";

export default function Page() {
  return (
    <>
      <PageHeader title="Register token">Create a signed entry for the Cardano token registry, so wallets show name, ticker, decimals and logo</PageHeader>
      <RegisterForm />
    </>
  );
}
