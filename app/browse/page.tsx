import SearchPage from "@/app/browse/search/[query]/page";

export const revalidate = 10

const Page = async () => {
  return (
    <SearchPage params={Promise.resolve({ query: '' })} />
  );
};

export default Page;
