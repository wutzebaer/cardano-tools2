import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { ReactNode } from "react";

export const inputClass = "input w-full border-line bg-base-300 focus-within:border-primary";
export const textareaClass = "textarea w-full border-line bg-base-300 focus-within:border-primary";
export const secondaryButtonClass = "btn btn-sm gap-2 border-line bg-base-300 hover:border-line-strong";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children ? <p className="mt-1 text-sm text-base-content/55">{children}</p> : null}
    </div>
  );
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
