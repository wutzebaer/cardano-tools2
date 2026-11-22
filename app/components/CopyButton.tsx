"use client";

import { secondaryButtonClass } from "@components/ui";
import { CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { ReactNode, useState } from "react";

export default function CopyButton({ text, children }: { text: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className={secondaryButtonClass} onClick={copy}>
      {copied ? <CheckIcon className="size-4 text-success" /> : <ClipboardIcon className="size-4" />}
      {children}
    </button>
  );
}
