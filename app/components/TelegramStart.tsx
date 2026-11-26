"use client";

import { TELEGRAM_BOT } from "@cardano/pool";
import { ExternalLink } from "@components/ui";
import { ReactNode, useState, useSyncExternalStore } from "react";

/** Puts a text on the clipboard, also where the browser of an app does not offer the clipboard to pages. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const done = document.execCommand("copy");
    field.remove();
    return done;
  }
}

const never = () => () => {};
/** A page shown inside an Android app, such as the browser of a wallet: Android marks it with "wv". */
const insideApp = () => /; wv\)/.test(navigator.userAgent);

/**
 * Opens the Telegram bot with a stake address. The browser inside a wallet app cannot leave for Telegram and shows
 * an error page instead, so there the button copies the message the link would send, to send it to the bot by hand.
 * The same is offered below the link everywhere else, for a browser this does not recognise.
 */
export default function TelegramStart({ stakeAddress, children }: { stakeAddress: string; children: ReactNode }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const embedded = useSyncExternalStore(never, insideApp, () => false);
  const message = `/start ${stakeAddress}`;

  const copy = async () => setCopied(await copyText(message));

  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-1.5 sm:items-end">
      {embedded ? (
        <button type="button" className="btn btn-primary" onClick={copy}>
          {children}
        </button>
      ) : (
        <ExternalLink href={`https://t.me/${TELEGRAM_BOT}?start=${stakeAddress}`} className="btn btn-primary">
          {children}
        </ExternalLink>
      )}
      {copied == null ? (
        embedded ? null : (
          <button type="button" className="py-1 text-left text-xs text-base-content/55 underline-offset-2 hover:text-base-content hover:underline sm:text-right" onClick={copy}>
            Telegram does not open? Copy the message for the bot
          </button>
        )
      ) : (
        <div className="flex max-w-full flex-col gap-1 text-xs text-base-content/65 sm:max-w-xs sm:text-right">
          <p>
            {embedded ? "This browser cannot open Telegram. " : ""}
            {copied ? "The message is copied: " : "Copy this message: "}
            open Telegram, find <span className="font-semibold text-base-content">@{TELEGRAM_BOT}</span> and send it.
          </p>
          <code className="rounded-field border border-line bg-base-300 px-2 py-1 text-left break-all select-all">{message}</code>
        </div>
      )}
    </div>
  );
}
