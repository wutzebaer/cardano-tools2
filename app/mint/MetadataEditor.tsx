"use client";

import { tokensFromMetadata, tokensMetadata } from "@cardano/metadata";
import { MintToken } from "@cardano/types";
import { textareaClass } from "@components/ui";
import { useState } from "react";

/** Edits the metadata of all tokens as JSON; applying it rebuilds the token list. */
export default function MetadataEditor({ tokens, onApply, onClose }: { tokens: MintToken[]; onApply: (tokens: MintToken[]) => void; onClose: () => void }) {
  const [json, setJson] = useState(() => JSON.stringify(tokensMetadata(tokens), null, 2));
  const [error, setError] = useState("");

  const parse = () => {
    try {
      setError("");
      return JSON.parse(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  };

  const format = () => {
    const parsed = parse();
    if (parsed !== undefined) setJson(JSON.stringify(parsed, null, 2));
  };

  const apply = () => {
    const parsed = parse();
    if (parsed === undefined) return;
    try {
      onApply(tokensFromMetadata(parsed, tokens));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="surface flex flex-col gap-3 p-5">
      <div>
        <p className="section-label">Metadata JSON</p>
        <p className="mt-1 text-xs text-base-content/55">
          One entry per asset name. Tokens are added, removed and renamed to match; amounts of existing tokens are kept. Nested objects and lists are stored in the CIP-68
          datum as they are.
        </p>
      </div>
      <textarea className={`${textareaClass} font-mono text-xs`} rows={18} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
      {error ? <p className="text-xs text-error">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
          Apply
        </button>
        <button type="button" className="btn btn-sm border-line bg-base-300" onClick={format}>
          Format
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
