"use client";

import { IssuesPage } from "@multica/views/issues/components";
import { useState, useEffect } from "react";

// Simple error boundary to catch and display errors
export default function Page() {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      console.error("Issues page error:", event.error);
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener("error", errorHandler);
    return () => window.removeEventListener("error", errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Failed to load issues
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return <IssuesPage />;
}
