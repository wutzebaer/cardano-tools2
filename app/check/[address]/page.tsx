import { Notice, PageHeader } from "@components/ui";
import type { Metadata } from "next";
import CheckForm from "../CheckForm";
import CheckResult from "../CheckResult";
import { checkSummary, load } from "../summary";

type Props = { params: Promise<{ address: string }> };

const inputOf = async (params: Props["params"]) => decodeURIComponent((await params).address);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name, summary } = await checkSummary(await inputOf(params));
  const title = `Staking check for ${name}`;
  return {
    title,
    description: summary,
    // results of single addresses are for sharing, not for search engines
    robots: { index: false },
    openGraph: { title, description: summary },
    twitter: { card: "summary_large_image", title, description: summary },
  };
}

export default async function Page({ params }: Props) {
  const input = await inputOf(params);
  const data = await load(input);
  return (
    <>
      <PageHeader title="Staking check" art="check" compact>
        Pool, fees, voting rights and rewards of a Cardano address
      </PageHeader>
      <div className="flex flex-col gap-4 sm:gap-8">
        <CheckForm initial={input} />
        {"error" in data ? <Notice tone="warning">{data.error}</Notice> : <CheckResult data={data} />}
      </div>
    </>
  );
}
