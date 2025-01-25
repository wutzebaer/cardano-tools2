"use client";

import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import React, { useState, useEffect } from 'react';


const ErrorToast = () => {
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setErrorMessages((prevMessages) => [
        ...prevMessages,
        event.reason?.message || event.reason?.info || (event.reason?.code ? `error: ${event.reason.code}` : undefined) || event.reason || "An unexpected error occurred."
      ]);

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
    <div className="toast toast-center toast-top">
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
