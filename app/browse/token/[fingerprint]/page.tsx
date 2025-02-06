import Token from '@components/Token';

interface PageProps {
    fingerprint: string;
}

async function Page({ params, }: { params: Promise<PageProps> }) {
    const fingerprint = (await params).fingerprint;
    return (
        <div className="flex justify-center">
            <Token fingerprint={fingerprint} maxEntries={100} className='w-full max-w-xl' />
        </div>
    )
}

export default Page
