import TokenOverlay from "@/app/browse/TokenOverlay";
import TokenDetail from "@components/TokenDetail";

export const revalidate = 10;

export default async function InterceptedTokenPage({
  params,
}: {
  params: Promise<{ fingerprint: string }>;
}) {
  const { fingerprint } = await params;
  return (
    <TokenOverlay>
      <TokenDetail fingerprint={fingerprint} closeOverlay />
    </TokenOverlay>
  );
}
