"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * A moment in the reader's own language, date format and time zone. The server knows none of them and prints
 * UTC, the browser replaces that right after loading.
 */
export default function LocalTime({ unix, time = false }: { unix: number; time?: boolean }) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const date = new Date(unix * 1000);
  const options: Intl.DateTimeFormatOptions = time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" };
  return <time dateTime={date.toISOString()}>{inBrowser ? date.toLocaleString(undefined, options) : date.toLocaleString("en-GB", { ...options, timeZone: "UTC" })}</time>;
}
