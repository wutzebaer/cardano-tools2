import { getTokenDetailsByFingerprint } from '@cardano/dbsync';
import { formatNumber, hexToUtf8, parseMetadata, shortenId, slotToDate, toDisplayMetadata, toIpfsUrl } from '@cardano/utils';
import { getCollectionInfo } from '@cardano/wayup';
import IpfsImage from '@components/IpfsImage';
import { Verified } from '@components/JpgStoreIcons';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="section-label">{title}</h2>
            {children}
        </section>
    );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <dt className="shrink-0 text-sm text-base-content/55">{label}</dt>
            <dd className="min-w-0 break-all text-right font-mono text-[13px]">{children}</dd>
        </div>
    );
}

async function TokenDetail({ fingerprint }: { fingerprint: string }) {
    const tokenDetails = await getTokenDetailsByFingerprint(fingerprint);
    const metadata = parseMetadata(tokenDetails.metadata);
    const displayMetadata = toDisplayMetadata(metadata);
    const collectionInfo = await getCollectionInfo(tokenDetails.maPolicyId);
    const assetName = hexToUtf8(tokenDetails.maName);
    const name = (typeof metadata.name === 'string' ? metadata.name : undefined) ?? assetName;
    const image = typeof metadata.image === 'string' ? metadata.image : '';
    const description = typeof metadata.description === 'string' && metadata.description !== name ? metadata.description : undefined;
    const properties = Object.entries(displayMetadata);

    return (
        <div className="flex flex-col gap-8">
            <Link href="/browse" className="flex w-fit items-center gap-1.5 text-sm text-base-content/55 hover:text-base-content">
                <ArrowLeftIcon className="size-4" />
                Browse
            </Link>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
                <div className="self-start lg:sticky lg:top-12">
                    <div className="surface overflow-hidden">
                        <IpfsImage
                            width="1024"
                            height="1024"
                            className="aspect-square w-full object-cover"
                            src={toIpfsUrl(image)}
                            alt={name}
                            priority
                        />
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-8">
                    <div className="flex flex-col gap-3">
                        <Link
                            href={`/browse/search/${tokenDetails.maPolicyId}`}
                            className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                            <span className="truncate">{collectionInfo.name ?? shortenId(tokenDetails.maPolicyId, 8)}</span>
                            {collectionInfo.verified ? <Verified /> : null}
                        </Link>
                        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
                        {description ? <p className="text-[15px] leading-relaxed text-base-content/65">{description}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href={`https://pool.pm/${tokenDetails.fingerprint}`}
                            target="_blank"
                            className="btn btn-sm gap-2 border-line bg-base-200 hover:border-line-strong hover:bg-base-300"
                        >
                            <Image src="/images/poolpm.ico" alt="" width="16" height="16" />
                            pool.pm
                            <ArrowTopRightOnSquareIcon className="size-3.5 text-base-content/45" />
                        </Link>
                        <Link
                            href={`https://www.wayup.io/collection/${collectionInfo.handle ?? tokenDetails.maPolicyId}`}
                            target="_blank"
                            className="btn btn-sm gap-2 border-line bg-base-200 hover:border-line-strong hover:bg-base-300"
                        >
                            <Image src="/images/wayup.svg" alt="" width="16" height="16" />
                            Wayup
                            <ArrowTopRightOnSquareIcon className="size-3.5 text-base-content/45" />
                        </Link>
                    </div>

                    {properties.length > 0 ? (
                        <Section title="Properties">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {properties.map(([key, value]) => {
                                    const text = String(value ?? '');
                                    const long = text.length > 40;
                                    return (
                                        <div key={key} className={`surface min-w-0 px-3 py-2.5 ${long ? 'col-span-full' : ''}`}>
                                            <p className="truncate text-[11px] uppercase tracking-wide text-base-content/45" title={key}>
                                                {key}
                                            </p>
                                            <p className={`text-sm font-medium ${long ? 'leading-relaxed' : 'truncate'}`} title={text}>
                                                {text.startsWith('http') ? (
                                                    <Link href={text} target="_blank" className="hover:text-primary">
                                                        {text.replace(/^https?:\/\//, '')}
                                                    </Link>
                                                ) : (
                                                    text
                                                )}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    ) : null}

                    <Section title="Details">
                        <dl className="surface divide-y divide-line">
                            <DetailRow label="Policy ID">
                                <Link href={`/browse/search/${tokenDetails.maPolicyId}`} className="hover:text-primary">
                                    {tokenDetails.maPolicyId}
                                </Link>
                            </DetailRow>
                            <DetailRow label="Fingerprint">{tokenDetails.fingerprint}</DetailRow>
                            <DetailRow label="Asset name">{assetName}</DetailRow>
                            <DetailRow label="Total supply">{formatNumber(tokenDetails.totalSupply)}</DetailRow>
                            <DetailRow label="Minted">{slotToDate(tokenDetails.slotNo)}</DetailRow>
                            <DetailRow label="Transaction">{tokenDetails.txHash}</DetailRow>
                        </dl>
                    </Section>
                </div>
            </div>
        </div>
    );
}

export default TokenDetail;
