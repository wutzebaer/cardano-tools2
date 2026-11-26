import PageArt, { pageArtColors, PageArtName } from "@components/PageArt";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { ReactNode } from "react";

export const inputClass = "input w-full border-line bg-base-300 focus-within:border-primary";
export const textareaClass = "textarea w-full border-line bg-base-300 focus-within:border-primary";
export const secondaryButtonClass = "btn btn-sm gap-2 border-line bg-base-300 hover:border-line-strong";

/** With `art` the header is a banner in the colours of the page with its drawing on the right. */
export function PageHeader({ title, children, art }: { title: string; children?: ReactNode; art?: PageArtName }) {
  if (art) {
    const { from, to } = pageArtColors(art);
    return (
      <div className="relative mb-8 overflow-hidden rounded-box border border-line bg-base-200">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(55% 140% at 88% 50%, ${from}38, transparent 70%), radial-gradient(45% 120% at 55% -10%, ${to}1f, transparent 70%)` }}
        />
        {/* behind the text on a phone, beside it from a tablet on */}
        <PageArt name={art} className="absolute inset-y-0 right-2 h-full w-auto opacity-25 sm:right-6 sm:opacity-100" />
        <div className="relative px-6 py-8 sm:max-w-[62%] sm:py-10">
          <h1 className="text-brand text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {children ? <p className="mt-2 text-sm leading-relaxed text-base-content/65">{children}</p> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-8">
      <h1 className="text-brand text-2xl font-semibold tracking-tight">{title}</h1>
      {children ? <p className="mt-1 text-sm text-base-content/55">{children}</p> : null}
    </div>
  );
}

/** The number in front of the heading of a step, for forms that lead through several steps. */
export function StepNumber({ children }: { children: ReactNode }) {
  return <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{children}</span>;
}

export function Field({ label, error, hint, children, className = "" }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      {label ? <span className="text-xs text-base-content/55">{label}</span> : null}
      {children}
      {/* an error always shows below its field, where it cannot push the field out of its row */}
      {error ? <span className="text-[11px] text-error">{error}</span> : null}
      {hint ? <span className="text-[11px] text-base-content/45">{hint}</span> : null}
    </label>
  );
}

export function ExternalLink({ href, children, className = secondaryButtonClass }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <ArrowTopRightOnSquareIcon className="size-3.5 text-base-content/45" />
    </Link>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "error" }) {
  const color = tone === "error" ? "border-error/40 text-error" : tone === "warning" ? "border-warning/40 text-warning" : "border-line text-base-content/65";
  return <div className={`rounded-field border bg-base-200 px-4 py-3 text-sm ${color}`}>{children}</div>;
}
