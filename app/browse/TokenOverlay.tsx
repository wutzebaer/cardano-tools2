"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function TokenOverlay({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const open = pathname.startsWith("/browse/token/");

  useEffect(() => {
    if (!open) {
      return;
    }
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-base-100 lg:left-72">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</div>
    </div>
  );
}
