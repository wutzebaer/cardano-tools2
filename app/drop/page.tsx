import { PageHeader } from "@components/ui";
import Link from "next/link";
import { YourDrops } from "./CreateDrop";

export const metadata = { title: "My drops" };

/** The drops created in this browser, and a field to open any other. A drop is created on the mint page, where its tokens are put together. */
export default function Page() {
  return (
    <>
      <PageHeader title="My drops">
        The drops you created, to see what is sold and to close them. A new one starts on the{" "}
        <Link className="link" href="/mint">
          Mint &amp; drop
        </Link>{" "}
        page.
      </PageHeader>
      <YourDrops />
    </>
  );
}
