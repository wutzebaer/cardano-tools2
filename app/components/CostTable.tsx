import { formatAda } from "@cardano/utils";

export interface CostRow {
  label: string;
  /** Said small behind the label, e.g. when the ADA comes back */
  hint?: string;
  lovelace: number;
  /** Estimated rather than worked out from the transaction */
  about?: boolean;
  /** A sum of the rows above it */
  sum?: boolean;
  tone?: "error";
}

/** Lovelace rounded to the two decimals a row shows. Sums are made of these, so that the rows add up as they read. */
export const shown = (lovelace: number) => Math.round(lovelace / 10_000) * 10_000;

/** What something costs, row by row, so that the sum the wallet shows is no surprise. */
export default function CostTable({ title, rows }: { title?: string; rows: CostRow[] }) {
  return (
    <div className="w-full max-w-md text-sm">
      {title ? <p className="section-label mb-1">{title}</p> : null}
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className={`flex items-baseline justify-between gap-4 py-1 ${row.sum ? "border-t border-line font-medium text-base-content" : "text-base-content/65"}`}>
            <dt className="min-w-0">
              {row.label}
              {row.hint ? <span className="ml-2 text-xs font-normal text-base-content/45">{row.hint}</span> : null}
            </dt>
            <dd className={`shrink-0 tabular-nums ${row.tone === "error" ? "text-error" : ""}`}>
              {row.about ? "≈ " : ""}
              {formatAda(row.lovelace)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
