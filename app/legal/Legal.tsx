import { ReactNode } from "react";

/** Body of a legal page: sections of a heading and paragraphs. */
export function LegalText({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <div lang={lang} className="flex max-w-3xl flex-col gap-3 text-sm leading-relaxed text-base-content/65">
      {children}
    </div>
  );
}

export function LegalHeading({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 text-base font-semibold text-base-content">{children}</h2>;
}

export const CONTACT_EMAIL = "cardano-tools-nft@email.de";
