"use client";

import { getDreps } from "@cardano/dbsync";
import { shortenId } from "@cardano/utils";
import { ExternalLink, inputClass } from "@components/ui";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

type Drep = Awaited<ReturnType<typeof getDreps>>[number];

const POWER = Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const power = (drep: Drep) => `${POWER.format(drep.votingPower / 1_000_000)} ₳`;

/** Where a DRep is described: its statement, its votes and who delegates to it. */
export const drepUrl = (drepId: string) =>
  `https://gov.tools/drep_directory/${drepId}`;

/**
 * Picks a DRep: from the list of the active ones, which narrows down while typing a name, or by pasting an id.
 */
export default function DrepPicker({
  value,
  onChange,
  knownName,
}: {
  value: string;
  onChange: (drepId: string) => void;
  knownName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dreps, setDreps] = useState<Drep[] | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // fetched right away: the name of a preselected DRep comes from the list as well
  useEffect(() => {
    let cancelled = false;
    getDreps().then((loaded) => {
      if (!cancelled) setDreps(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // a click anywhere else closes the list
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = dreps?.find((drep) => drep.drepId === value);
  const name = selected?.name ?? (value ? knownName : null);
  const needle = query.trim().toLowerCase();
  const matches = (dreps ?? []).filter(
    (drep) =>
      !needle ||
      drep.name?.toLowerCase().includes(needle) ||
      drep.objectives?.toLowerCase().includes(needle) ||
      drep.drepId.includes(needle),
  );

  const choose = (drepId: string) => {
    onChange(drepId);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={root} className="flex min-w-0 grow flex-col gap-2">
      {/* the list opens right below the field, above what follows */}
      <div className="relative">
        <button
          type="button"
          className="input flex w-full items-center justify-between gap-2 border-line bg-base-300 text-left"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className={`truncate ${value ? "" : "text-base-content/45"}`}>
            {value ? (
              <>
                {name ?? "DRep without a name"}{" "}
                <span className="font-mono text-[11px] text-base-content/45">
                  {shortenId(value, 8)}
                </span>
                {selected ? (
                  <span className="text-base-content/55">
                    {" "}
                    · {power(selected)} delegated
                  </span>
                ) : null}
              </>
            ) : (
              "Pick a representative…"
            )}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-base-content/55" />
        </button>

        {open ? (
          <div className="absolute top-full z-20 mt-1 w-full rounded-field border border-line bg-base-200 p-2 shadow-xl">
            <input
              className={`${inputClass} input-sm mb-2`}
              placeholder="Search names and goals, or paste an id (drep1…)"
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  // an id that is not in the list can be chosen as well, e.g. a DRep that registered today
                  if (matches.length > 0) choose(matches[0].drepId);
                  else if (query.trim().startsWith("drep1"))
                    choose(query.trim());
                }
              }}
            />
            {!dreps ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-sm text-primary" />
              </div>
            ) : (
              <ul role="listbox" className="max-h-80 overflow-y-auto">
                {matches.map((drep) => (
                  <li
                    key={drep.drepId}
                    role="option"
                    aria-selected={drep.drepId === value}
                  >
                    <button
                      type="button"
                      className={`flex w-full flex-col gap-0.5 rounded-field px-2 py-1.5 text-left text-sm hover:bg-base-300 ${drep.drepId === value ? "bg-base-300" : ""}`}
                      onClick={() => choose(drep.drepId)}
                    >
                      <span className="flex w-full items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {drep.name ?? (
                            <span className="text-base-content/55">
                              no name
                            </span>
                          )}{" "}
                          <span className="font-mono text-[11px] text-base-content/45">
                            {shortenId(drep.drepId, 6)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-base-content/55">
                          {power(drep)}
                        </span>
                      </span>
                      {drep.objectives ? (
                        <span className="line-clamp-2 text-xs text-base-content/55">
                          {drep.objectives}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
                {matches.length === 0 ? (
                  <li className="px-2 py-1.5 text-sm text-base-content/55">
                    {query.trim().startsWith("drep1")
                      ? "Not among the active DReps. Press Enter to use this id anyway."
                      : "No active DRep matches."}
                  </li>
                ) : null}
              </ul>
            )}
            <p className="mt-2 px-2 text-[11px] text-base-content/45">
              The active DReps, the one with the most ADA delegated first. Size
              says nothing about how a DRep votes. The line below a name is what
              the DRep says about its own goals.
            </p>
          </div>
        ) : null}
      </div>

      {value ? (
        <div className="flex flex-col gap-2">
          {selected?.objectives ? (
            <p className="text-sm text-base-content/65">
              <span className="text-base-content/45">In its own words: </span>
              {selected.objectives}
              {selected.objectives.length >= 240 ? "…" : ""}
            </p>
          ) : null}
          <div>
            <ExternalLink href={drepUrl(value)}>
              Read about this DRep on gov.tools
            </ExternalLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
