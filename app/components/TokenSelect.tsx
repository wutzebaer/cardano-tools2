"use client";

import { assetKey, WalletAsset } from "@cardano/assets";
import { assetNameFromHex, shortenId } from "@cardano/utils";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";

const tokenName = (asset: WalletAsset) => assetNameFromHex(asset.name) || "(no name)";

/** Picks one of the wallet's tokens: sorted by name, narrowed down by typing a part of the name or policy id. */
export default function TokenSelect({ assets, value, onChange }: { assets: Iterable<WalletAsset>; value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...assets]
        .map((asset) => ({ key: assetKey(asset.policyId, asset.name), asset, name: tokenName(asset) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }) || a.key.localeCompare(b.key)),
    [assets]
  );
  const selected = sorted.find((option) => option.key === value);
  const needle = query.trim().toLowerCase();
  const matches = needle ? sorted.filter((option) => option.name.toLowerCase().includes(needle) || option.asset.policyId.includes(needle)) : sorted;

  // a click anywhere else closes the list
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 border-line bg-base-300 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={`truncate ${selected ? "" : "text-base-content/45"}`}>
          {selected ? `${selected.name} · ${shortenId(selected.asset.policyId)} · ${selected.asset.quantity}` : "Select a token…"}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-base-content/55" />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-field border border-line bg-base-200 p-2 shadow-xl">
          <input
            className="input input-sm mb-2 w-full border-line bg-base-300"
            placeholder="Search by name or policy id"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && matches.length > 0) choose(matches[0].key);
            }}
          />
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {matches.map((option) => (
              <li key={option.key} role="option" aria-selected={option.key === value}>
                <button
                  type="button"
                  className={`flex w-full items-baseline justify-between gap-3 rounded-field px-2 py-1.5 text-left text-sm hover:bg-base-300 ${option.key === value ? "bg-base-300" : ""}`}
                  onClick={() => choose(option.key)}
                >
                  <span className="min-w-0 truncate">
                    {option.name} <span className="font-mono text-[11px] text-base-content/45">{shortenId(option.asset.policyId)}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-base-content/55">{`${option.asset.quantity}`}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 ? <li className="px-2 py-1.5 text-sm text-base-content/55">No token matches.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
