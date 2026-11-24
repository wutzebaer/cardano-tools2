import { getPolicyRoyalties, getTokenDetailsByFingerprint } from '@cardano/dbsync';
import { currentSlot, explorerAddressUrl, explorerAssetUrl, IS_MAINNET, slotToUnix } from '@cardano/network';
import LocalTime from '@components/LocalTime';
import { assetNameFromHex, formatNumber, formatTokenAmount, policyLockSlot, metadataDecimals, parseMetadata, shortenId, toDisplayMetadata, tokenFiles, tokenImage, toIpfsUrl } from '@cardano/utils';
import { getCollectionInfo } from '@cardano/wayup';
import IpfsImage from '@components/IpfsImage';
import TokenImagePlaceholder from '@components/TokenImagePlaceholder';
import { Verified } from '@components/JpgStoreIcons';
import BackToBrowse from '@components/BackToBrowse';
import CopyButton from '@components/CopyButton';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
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

function propertyHref(key: string, text: string) {
    if (text.startsWith('http://') || text.startsWith('https://')) {
        return text;
    }
    if (text.startsWith('ipfs://') || text.startsWith('ar://') || text.startsWith('data:')) {
        return toIpfsUrl(text);
    }
    if (text.startsWith('@') && /twitter|\bx\b|follow/i.test(key)) {
        return `https://x.com/${text.slice(1)}`;
    }
    return null;
}

const PROPERTY_PATH_SEP = ' / ';

function groupedProperties(entries: [string, unknown][]) {
    const groups = new Map<string, [string, string][]>();
    for (const [key, value] of entries) {
        const i = key.indexOf(PROPERTY_PATH_SEP);
        const group = i === -1 ? '' : key.slice(0, i);
        const label = i === -1 ? key : key.slice(i + PROPERTY_PATH_SEP.length);
        const items = groups.get(group) ?? [];
        items.push([label, String(value ?? '')]);
        groups.set(group, items);
    }
    return [...groups].map(([group, items]) => ({
        title: group || 'Properties',
        items,
    }));
}

function PropertyCards({ items }: { items: [string, string][] }) {
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map(([key, text], i) => {
                const href = propertyHref(key, text);
                const long = text.length > 40;
                return (
                    <div key={`${key}-${i}`} className={`surface min-w-0 px-3 py-2.5 ${long ? 'col-span-full' : ''}`}>
                        {/^\d+$/.test(key) ? null : (
                            <p className="truncate text-[11px] uppercase tracking-wide text-base-content/45" title={key}>
                                {key}
                            </p>
                        )}
                        <p className={`text-sm font-medium ${long ? 'leading-relaxed' : 'truncate'}`} title={text}>
                            {href ? (
                                <Link href={href} target="_blank" className="hover:text-primary">
                                    {text.startsWith('http') ? text.replace(/^https?:\/\//, '') : text}
                                </Link>
                            ) : (
                                text
                            )}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

async function TokenDetail({ fingerprint, closeOverlay }: { fingerprint: string; closeOverlay?: boolean }) {
    const tokenDetails = await getTokenDetailsByFingerprint(fingerprint);
    const metadata = parseMetadata(tokenDetails.metadata, tokenDetails.maPolicyId, tokenDetails.maName);
    const displayMetadata = toDisplayMetadata(metadata);
    const [collectionInfo, royalties] = await Promise.all([getCollectionInfo(tokenDetails.maPolicyId), getPolicyRoyalties(tokenDetails.maPolicyId)]);
    const royaltyRate = Number(royalties?.rate);
    const assetName = assetNameFromHex(tokenDetails.maName);
    const name = (typeof metadata.name === 'string' ? metadata.name : undefined) ?? assetName;
    const image = tokenImage(metadata);
    const imageSrc = toIpfsUrl(image);
    const description = typeof metadata.description === 'string' && metadata.description !== name ? metadata.description : undefined;
    const decimals = metadataDecimals(metadata);
    const files = tokenFiles(metadata, image);
    const propertyGroups = groupedProperties(Object.entries(displayMetadata));
    const lockSlot = policyLockSlot(tokenDetails.maPolicyScript);
    const locked = lockSlot != null && lockSlot <= currentSlot();
    const isNft = locked && tokenDetails.totalSupply === 1;

    return (
        <div className="flex flex-col gap-8">
            <BackToBrowse closeOverlay={closeOverlay} />

            <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
                <div className="self-start lg:sticky lg:top-12">
                    <div className="surface overflow-hidden">
                        {imageSrc ? (
                            <IpfsImage
                                width="1024"
                                height="1024"
                                className="h-auto w-full"
                                src={imageSrc}
                                alt={name}
                                priority
                            />
                        ) : (
                            <TokenImagePlaceholder />
                        )}
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
                        <h1 className="text-brand break-words text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
                        {description ? <p className="text-[15px] leading-relaxed text-base-content/65">{description}</p> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {IS_MAINNET ? (
                            <>
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
                            </>
                        ) : (
                            <Link
                                href={explorerAssetUrl(tokenDetails.fingerprint)}
                                target="_blank"
                                className="btn btn-sm gap-2 border-line bg-base-200 hover:border-line-strong hover:bg-base-300"
                            >
                                cexplorer
                                <ArrowTopRightOnSquareIcon className="size-3.5 text-base-content/45" />
                            </Link>
                        )}
                        {tokenDetails.metadata ? <CopyButton text={JSON.stringify(JSON.parse(tokenDetails.metadata), null, 2)}>Copy metadata</CopyButton> : null}
                    </div>

                    {propertyGroups.map(({ title, items }) => (
                        <Section key={title} title={title}>
                            <PropertyCards items={items} />
                        </Section>
                    ))}

                    {files.length > 0 ? (
                        <Section title="Files">
                            <PropertyCards
                                items={files.map((file, i) => [
                                    file.name || file.mediaType || `File ${i + 1}`,
                                    file.src,
                                ])}
                            />
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
                            <DetailRow label="Total supply">
                                {formatTokenAmount(tokenDetails.totalSupply, decimals)}
                                {isNft ? <span className="ml-2 font-sans text-xs text-success">unique, supply is final</span> : null}
                            </DetailRow>
                            <DetailRow label="Policy lock">
                                {lockSlot == null ? (
                                    <span className="font-sans">{tokenDetails.maPolicyScript ? 'no time lock, more can be minted or burned' : 'decided by a smart contract'}</span>
                                ) : (
                                    <>
                                        <LocalTime unix={slotToUnix(lockSlot)} time />
                                        <span className={`ml-2 font-sans text-xs ${locked ? 'text-success' : 'text-warning'}`}>{locked ? 'locked' : 'still open'}</span>
                                    </>
                                )}
                            </DetailRow>
                            {royalties ? (
                                <DetailRow label="Royalties">
                                    <span className="font-sans">{Number.isFinite(royaltyRate) ? `${formatNumber(royaltyRate * 100)} %` : royalties.rate}</span>
                                    {royalties.address ? (
                                        <>
                                            <span className="font-sans text-base-content/55"> to </span>
                                            <Link href={explorerAddressUrl(royalties.address)} target="_blank" className="hover:text-primary" title={royalties.address}>
                                                {shortenId(royalties.address, 12)}
                                            </Link>
                                        </>
                                    ) : null}
                                    {royalties.firstMint ? null : (
                                        <span className="ml-2 font-sans text-xs text-warning" title="CIP-27 only counts a royalty token minted before any other token of the policy">
                                            not the policy&apos;s first token, marketplaces may ignore it
                                        </span>
                                    )}
                                </DetailRow>
                            ) : null}
                            <DetailRow label="Minted"><LocalTime unix={slotToUnix(tokenDetails.slotNo)} time /></DetailRow>
                            <DetailRow label="Transaction">{tokenDetails.txHash}</DetailRow>
                        </dl>
                    </Section>
                </div>
            </div>
        </div>
    );
}

export default TokenDetail;
