"use client";

import { loadFeedPage, loadSearchPage, TokenPage } from "@/app/browse/loadTokens";
import TokenCard from "@components/TokenCard";
import { useEffect, useRef, useState } from "react";

export default function TokenGrid({ query, initial }: { query?: string; initial: TokenPage }) {
  const [tokens, setTokens] = useState(initial.tokens);
  const [collections, setCollections] = useState(initial.collections);
  const [cursor, setCursor] = useState(initial.cursor);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const pollingRef = useRef(false);
  const newestMintIdRef = useRef(initial.newestMintId);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query) {
      return;
    }
    const interval = setInterval(() => {
      const afterMintid = newestMintIdRef.current;
      if (afterMintid == null || pollingRef.current) {
        return;
      }
      pollingRef.current = true;
      loadFeedPage(undefined, afterMintid)
        .then((page) => {
          if (page.newestMintId != null) {
            newestMintIdRef.current = page.newestMintId;
          }
          if (page.tokens.length === 0) {
            return;
          }
          setTokens((prev) => {
            const seen = new Set(prev.map((token) => token.maMintId));
            return [...page.tokens.filter((token) => !seen.has(token.maMintId)), ...prev];
          });
          setCollections((prev) => ({ ...prev, ...page.collections }));
        })
        .finally(() => {
          pollingRef.current = false;
        });
    }, 10_000);
    return () => clearInterval(interval);
  }, [query]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }
    const el = sentinelRef.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingRef.current) {
          return;
        }
        loadingRef.current = true;
        setLoading(true);
        const request = query ? loadSearchPage(query, cursor as string | undefined) : loadFeedPage(cursor as number | undefined);
        request.then((page) => {
          setTokens((prev) => [...prev, ...page.tokens]);
          setCollections((prev) => ({ ...prev, ...page.collections }));
          setCursor(page.cursor);
          setHasMore(page.hasMore);
          loadingRef.current = false;
          setLoading(false);
        });
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, cursor, query]);

  if (tokens.length === 0 && !hasMore) {
    return <div className="surface px-6 py-16 text-center text-sm text-base-content/55">No tokens found.</div>;
  }

  return (
    <>
      {tokens.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-5">
          {tokens.map((token) => (
            <TokenCard key={`${token.maFingerprint}-${token.maMintId}`} item={token} collection={collections[token.maPolicyId]} />
          ))}
        </div>
      ) : null}
      {hasMore ? <div ref={sentinelRef} className="flex justify-center py-8">{loading ? <span className="loading loading-spinner loading-md text-primary" /> : null}</div> : null}
    </>
  );
}
