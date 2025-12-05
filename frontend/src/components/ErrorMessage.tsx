"use client";

import { useState } from "react";
import { parseError } from "@/lib/errorHandler";

interface ErrorMessageProps {
  error: any;
  onDismiss?: () => void;
}

export function ErrorMessage({ error, onDismiss }: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const parsedError = parseError(error);

  return (
    <div className="bg-red-900/30 border border-red-600 rounded-xl p-4">
      <div className="flex items-start gap-3">
        {/* Error Icon */}
        <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        {/* Error Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-semibold text-red-400">{parsedError.title}</p>
              <p className="text-sm text-gray-300 mt-1">{parsedError.message}</p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-red-400 hover:text-red-300 transition"
                title="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Technical Details Toggle */}
          {parsedError.details && (
            <div className="mt-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-red-400 hover:text-red-300 underline flex items-center gap-1"
              >
                {showDetails ? "Hide" : "Show"} technical details
                <svg
                  className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showDetails && (
                <div className="mt-2 p-3 bg-red-950/50 rounded-lg border border-red-800">
                  <pre className="text-xs text-red-200 whitespace-pre-wrap break-all font-mono max-h-40 overflow-y-auto">
                    {parsedError.details}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
