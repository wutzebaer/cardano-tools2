"use client";

import { errorToMessage } from "@cardano/utils";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

const RELOADED_AT_KEY = "outdatedReloadAt";

/**
 * After a release the server no longer knows the server actions of a page that is still open from before.
 * Such a page loads itself again, at most once a minute so that a broken release cannot make it reload forever.
 */
function reloadIfOutdated(message: string): boolean {
  if (!/Server Action .* was not found on the server/.test(message)) return false;
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT_KEY) ?? 0) < 60_000) return false;
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    // without session storage there is no way to tell a reload loop, the message is shown instead
    return false;
  }
  window.location.reload();
  return true;
}

const ErrorToast = () => {
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (reloadIfOutdated(errorToMessage(event.reason))) return;
      setErrorMessages((prevMessages) => [...prevMessages, errorToMessage(event.reason)]);

      // Clear the specific error message after 5 seconds
      setTimeout(() => {
        setErrorMessages((prevMessages) => prevMessages.slice(1));
      }, 5000);
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return (
    <div className="toast toast-center toast-top z-50">
      {errorMessages.map((message, index) => (
        <div key={index} className="alert alert-warning flex items-center">
          <ExclamationCircleIcon className="h-6" />
          <span>{message}</span>
        </div>
      ))}
    </div>
  );
};

export default ErrorToast;
