import BrowseTokens from "@/app/browse/BrowseTokens";
import CollectionHeader from "@/app/browse/CollectionHeader";
import { getCollectionInfo } from "@cardano/wayup";

export const revalidate = 10;
export const generateStaticParams = async () => {
  return [];
};

export default async function SearchPage({ params }: { params: Promise<{ query?: string }> }) {
  const { query } = await params;
  const text = query ? decodeURIComponent(query) : query;
  // a search for a policy shows its tokens, so what is known about the collection goes on top
  const collection = text && /^[0-9a-f]{56}$/.test(text) ? await getCollectionInfo(text) : undefined;
  return (
    <>
      {collection?.name ? <CollectionHeader policyId={text!} collection={collection} /> : null}
      <BrowseTokens query={text} />
    </>
  );
}
