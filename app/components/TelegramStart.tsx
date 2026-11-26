"use client";

import { TELEGRAM_BOT } from "@cardano/pool";
import { ExternalLink } from "@components/ui";
import { ReactNode, useState } from "react";

/**
 * Opens the Telegram bot with a stake address. The browser inside a wallet app often cannot leave for Telegram, so
 * the message the link would send can be copied and sent to the bot by hand.
 */
export default function TelegramStart({ stakeAddress, children }: { stakeAddress: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(`/start ${stakeAddress}`);
    setCopied(true);
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
      <ExternalLink href={`https://t.me/${TELEGRAM_BOT}?start=${stakeAddress}`} className="btn btn-primary">
        {children}
      </ExternalLink>
      <button type="button" className="py-1 text-left text-xs text-base-content/55 underline-offset-2 hover:text-base-content hover:underline sm:text-right" onClick={copy}>
        {copied ? `Copied. Send it to @${TELEGRAM_BOT} in Telegram.` : "Telegram does not open? Copy the message for the bot"}
      </button>
    </div>
  );
}
