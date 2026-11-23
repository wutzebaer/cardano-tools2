'use client';

import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Pages shown since the site was loaded. Above zero there is a page of this site to go back to. */
let pagesShown = 0;

/** Counts the pages shown, rendered once in the root layout. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    pagesShown++;
  }, [pathname]);
  return null;
}

const className = "flex w-fit items-center gap-1.5 text-sm text-base-content/55 hover:text-base-content";

/** Leads back to where the visitor came from, e.g. "My tokens", or to Browse when the page was opened directly. */
export default function BackToBrowse({ closeOverlay }: { closeOverlay?: boolean }) {
  const router = useRouter();
  // decided once: the tracker counts this page too, right after it is shown
  const [cameFromSite] = useState(() => pagesShown > 0);

  if (closeOverlay || cameFromSite) {
    return (
      <button type="button" onClick={() => router.back()} className={className}>
        <ArrowLeftIcon className="size-4" />
        {closeOverlay ? "Browse" : "Back"}
      </button>
    );
  }

  return (
    <Link href="/browse" className={className}>
      <ArrowLeftIcon className="size-4" />
      Browse
    </Link>
  );
}
