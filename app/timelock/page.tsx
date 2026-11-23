import { PageHeader } from "@components/ui";
import TimelockForm from "./TimelockForm";

export default function Page() {
  return (
    <>
      <PageHeader title="Timelock">Lock ADA and tokens away until a date, and take them back when it has passed</PageHeader>
      <TimelockForm />
    </>
  );
}
