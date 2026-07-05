"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { strings } from "@/strings";

/**
 * Renders the four mandatory data-view states (§6.3): loading, error, empty, success.
 * A failed BACKGROUND refetch must never blank out data we already have — the hooks poll
 * public testnet RPC every 4s, and react-query flips `isError` on a failed refetch even
 * while `data` is still cached. So: data wins; the full error panel is reserved for
 * "errored with nothing to show".
 */
export function QueryState<T>({
  query,
  isEmpty,
  children,
}: {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) {
    return (
      <>
        {query.isError ? (
          <p className="text-xs text-amber-700">{strings.staleData}</p>
        ) : null}
        {isEmpty?.(query.data) ? (
          <p className="text-neutral-500">{strings.empty}</p>
        ) : (
          children(query.data)
        )}
      </>
    );
  }

  if (query.isError) {
    return (
      <div className="flex items-center gap-3 text-red-600">
        <p>{strings.errorGeneric}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="underline underline-offset-2"
        >
          {strings.retry}
        </button>
      </div>
    );
  }

  return <p className="text-neutral-500">{strings.loading}</p>;
}
