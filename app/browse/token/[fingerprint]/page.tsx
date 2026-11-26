import TokenDetail from "@components/TokenDetail";

export const revalidate = 10;
export const generateStaticParams = async () => {
  return [];
};

async function page({ params }: { params: Promise<{ fingerprint: string }> }) {
  const { fingerprint } = await params;
  return <TokenDetail fingerprint={fingerprint} />;
}

export default page;
