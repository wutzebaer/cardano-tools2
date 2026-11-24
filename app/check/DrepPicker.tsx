"use client";

import { getDreps } from "@cardano/dbsync";
import { shortenId } from "@cardano/utils";
import { ExternalLink, inputClass } from "@components/ui";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DrepVote, latestDrepVote } from "./drepVotes";

type Drep = Awaited<ReturnType<typeof getDreps>>[number];

const POWER = Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

const power = (drep: Drep) => `${POWER.format(drep.votingPower / 1_000_000)} ₳`;

/** Where a DRep is described: its statement, its votes and who delegates to it. */
export const drepUrl = (drepId: string) => `https://gov.tools/drep_directory/${drepId}`;

/** The API cuts the goals of a DRep to this length */
const OBJECTIVES_LENGTH = 240;

const VOTE_STYLE: Record<string, string> = {
  Yes: "bg-success/15 text-success",
  No: "bg-error/15 text-error",
  Abstain: "bg-base-content/10 text-base-content/65",
};

const votesCast = (drep: Drep) => drep.votesYes + drep.votesNo + drep.votesAbstain;

/** How a DRep voted on the recent proposals, as one bar: yes, no, abstain, and the rest it did not vote on. */
function VoteBar({ drep, className = "w-20" }: { drep: Drep; className?: string }) {
  const total = Math.max(drep.recentActions, votesCast(drep), 1);
  const share = (count: number) => `${(count / total) * 100}%`;
  return (
    <span
      className={`flex h-1.5 shrink-0 overflow-hidden rounded-full bg-base-content/10 ${className}`}
      title={`Voted on ${votesCast(drep)} of the last ${drep.recentActions} proposals: ${drep.votesYes} yes, ${drep.votesNo} no, ${drep.votesAbstain} abstain`}
    >
      <span className="bg-success" style={{ width: share(drep.votesYes) }} />
      <span className="bg-error" style={{ width: share(drep.votesNo) }} />
      <span className="bg-base-content/40" style={{ width: share(drep.votesAbstain) }} />
    </span>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`mr-1 inline-block size-2 rounded-full ${className}`} />;
}

/**
 * Picks a DRep: from the list of the active ones, which narrows down while typing, or by pasting an id.
 * The chosen one is shown below with its goals and how it voted lately.
 */
export default function DrepPicker({ value, onChange, knownName }: { value: string; onChange: (drepId: string) => void; knownName?: string | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dreps, setDreps] = useState<Drep[] | null>(null);
  const [latest, setLatest] = useState<{ drepId: string; vote: DrepVote | null } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // what the chosen DRep voted on last, fetched per choice
  useEffect(() => {
    if (!value.startsWith("drep1")) return;
    let cancelled = false;
    latestDrepVote(value)
      .catch(() => null)
      .then((vote) => {
        if (!cancelled) setLatest({ drepId: value, vote });
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

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
  const latestVote = latest?.drepId === value ? latest.vote : null;
  const name = selected?.name ?? (value ? knownName : null);
  const needle = query.trim().toLowerCase();
  const matches = (dreps ?? []).filter(
    (drep) => !needle || drep.name?.toLowerCase().includes(needle) || drep.objectives?.toLowerCase().includes(needle) || drep.drepId.includes(needle)
  );

  const choose = (drepId: string) => {
    onChange(drepId);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={root} className="flex min-w-0 grow flex-col gap-3">
      {/* the list opens right below the field, above what follows */}
      <div className="relative">
        <button type="button" className="input flex w-full items-center justify-between gap-2 border-line bg-base-300 text-left" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className={`truncate ${value ? "font-medium" : "text-base-content/45"}`}>{value ? (name ?? `DRep ${shortenId(value, 8)}`) : "Pick a representative…"}</span>
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
                  else if (query.trim().startsWith("drep1")) choose(query.trim());
                }
              }}
            />
            {!dreps ? (
              <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-sm text-primary" />
              </div>
            ) : (
              <ul role="listbox" className="max-h-80 divide-y divide-line overflow-y-auto">
                {matches.map((drep) => (
                  <li key={drep.drepId} role="option" aria-selected={drep.drepId === value}>
                    <button
                      type="button"
                      className={`flex w-full flex-col gap-0.5 rounded-field px-2 py-2 text-left text-sm hover:bg-base-300 ${drep.drepId === value ? "bg-base-300" : ""}`}
                      onClick={() => choose(drep.drepId)}
                    >
                      <span className="flex w-full items-center gap-3">
                        <span className="min-w-0 grow truncate font-medium">{drep.name ?? <span className="font-normal text-base-content/55">no name, {shortenId(drep.drepId, 6)}</span>}</span>
                        <VoteBar drep={drep} className="w-16" />
                        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-base-content/55">{power(drep)}</span>
                      </span>
                      {drep.objectives ? <span className="truncate text-xs text-base-content/55">{drep.objectives}</span> : null}
                    </button>
                  </li>
                ))}
                {matches.length === 0 ? (
                  <li className="px-2 py-1.5 text-sm text-base-content/55">{query.trim().startsWith("drep1") ? "Not among the active DReps. Press Enter to use this id anyway." : "No active DRep matches."}</li>
                ) : null}
              </ul>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-[11px] text-base-content/45">
              <span>Bar: votes on the last {dreps?.[0]?.recentActions ?? ""} proposals</span>
              <span>
                <Dot className="bg-success" />
                yes
              </span>
              <span>
                <Dot className="bg-error" />
                no
              </span>
              <span>
                <Dot className="bg-base-content/40" />
                abstain
              </span>
              <span className="ml-auto">₳ delegated, largest first</span>
            </p>
          </div>
        ) : null}
      </div>

      {selected ? (
        <div className="flex flex-col gap-3 rounded-field border border-line bg-base-300/40 p-3">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-base-content/45">Delegated to it</dt>
              <dd className="text-sm font-medium tabular-nums">{power(selected)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-base-content/45">
                Voted on {votesCast(selected)} of the last {selected.recentActions} proposals
              </dt>
              <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content/65">
                <VoteBar drep={selected} className="w-28" />
                <span>
                  <Dot className="bg-success" />
                  {selected.votesYes} yes
                </span>
                <span>
                  <Dot className="bg-error" />
                  {selected.votesNo} no
                </span>
                <span>
                  <Dot className="bg-base-content/40" />
                  {selected.votesAbstain} abstain
                </span>
              </dd>
            </div>
          </dl>
          {latestVote ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-base-content/45">Its latest vote</p>
              <p className="mt-0.5 flex items-baseline gap-2 text-sm">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${VOTE_STYLE[latestVote.vote] ?? VOTE_STYLE.Abstain}`}>{latestVote.vote}</span>
                <span className="min-w-0 truncate" title={latestVote.title}>
                  {latestVote.title}
                </span>
                {latestVote.title.startsWith(latestVote.kind) ? null : <span className="hidden shrink-0 text-xs text-base-content/45 sm:inline">{latestVote.kind}</span>}
              </p>
            </div>
          ) : null}
          {selected.objectives ? (
            <p className="line-clamp-2 text-xs text-base-content/65" title={selected.objectives}>
              <span className="text-base-content/45">Its goals: </span>
              {selected.objectives}
              {selected.objectives.length >= OBJECTIVES_LENGTH ? "…" : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link href={`/votes/${value}`} target="_blank" className="btn btn-xs border-line bg-base-300">
              See each vote
            </Link>
            <ExternalLink href={drepUrl(value)}>gov.tools</ExternalLink>
          </div>
        </div>
      ) : value ? (
        <div>
          <ExternalLink href={drepUrl(value)}>gov.tools</ExternalLink>
        </div>
      ) : null}
    </div>
  );
}
