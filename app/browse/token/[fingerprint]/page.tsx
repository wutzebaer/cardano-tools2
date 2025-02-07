import Token from '@components/Token';


export const revalidate = 10
export const generateStaticParams = async () => {
    return [];
};

async function page({ params }: {
    params: Promise<{ fingerprint: string; }>
}) {
    const { fingerprint } = await params;
    return (
        <div className="flex justify-center">
            <Token fingerprint={fingerprint} maxEntries={100} className='w-full max-w-xl' />
        </div>
    )
}

export default page
