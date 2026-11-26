"use client";

import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useParams, useRouter } from "next/navigation";
import { ChangeEvent, KeyboardEvent, useState, useTransition } from "react";

const SearchInput: React.FC = () => {
  const router = useRouter();
  const { query } = useParams<{ query?: string }>();
  const [searchTerm, setSearchTerm] = useState<string>(query ? decodeURIComponent(query) : "");
  const [, startTransition] = useTransition();

  const goToSearch = (term: string) => {
    const trimmed = term.trim();
    startTransition(() => {
      router.replace(trimmed ? `/browse/search/${encodeURIComponent(trimmed)}` : "/browse");
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      goToSearch(searchTerm);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClear = () => {
    setSearchTerm("");
    goToSearch("");
  };

  return (
    <label className="input w-full border-line bg-base-200 focus-within:border-primary focus-within:outline-none sm:w-80">
      <MagnifyingGlassIcon className="size-4 shrink-0 text-base-content/45" />
      <input type="text" value={searchTerm} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="Policy ID or fingerprint" className="grow text-sm" />
      {searchTerm ? (
        <button type="button" onClick={handleClear} aria-label="Clear search" className="text-base-content/45 hover:text-base-content">
          <XMarkIcon className="size-4" />
        </button>
      ) : null}
    </label>
  );
};

export default SearchInput;
