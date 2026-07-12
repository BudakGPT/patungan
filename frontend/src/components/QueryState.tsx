"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useStrings } from "@/lib/locale";

/**
 * Renders the four data-view states: loading, error, empty, success.
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
  const strings = useStrings();
  if (query.data !== undefined) {
    return (
      <>
        {query.isError ? (
          <p className="text-xs text-amber-700">{strings.staleData}</p>
        ) : null}
        {isEmpty?.(query.data) ? (
          <div className="state-panel px-5 py-8 text-center text-sm text-muted">{strings.empty}</div>
        ) : (
          children(query.data)
        )}
      </>
    );
  }

  if (query.isError) {
    return (
      <div className="state-panel flex flex-col items-center gap-3 px-5 py-8 text-center text-cat-disaster sm:flex-row sm:justify-center">
        <p>{strings.errorGeneric}</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="action-link"
        >
          {strings.retry}
        </button>
      </div>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-muted">
      <span className="size-2 animate-pulse rounded-full bg-lime ring-4 ring-lime/20" />
      {strings.loading}
    </p>
  );
}
