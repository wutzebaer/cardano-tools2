import BrowseTokens from "@/app/browse/BrowseTokens";

export const revalidate = 10;
export const generateStaticParams = async () => {
  return [];
};

export default async function SearchPage({ params }: { params: Promise<{ query?: string }> }) {
  const { query } = await params;
  return <BrowseTokens query={query ? decodeURIComponent(query) : query} />;
}
