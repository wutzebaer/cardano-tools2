"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const NavLink = ({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) => {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-base-300 text-base-content"
          : "text-base-content/65 hover:bg-base-200 hover:text-base-content"
      }`}
    >
      <span className={`flex size-5 items-center justify-center ${active ? "text-primary" : ""}`}>{icon}</span>
      {children}
    </Link>
  );
};

export default NavLink;
