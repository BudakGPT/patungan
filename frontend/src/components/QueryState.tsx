"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { strings } from "@/strings";

/** Renders the four mandatory data-view states (§6.3): loading, error, empty, success. */
export function QueryState<T>({
  query,
  isEmpty,
  children,
}: {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return <p className="text-neutral-500">{strings.loading}</p>;
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

  if (isEmpty?.(query.data)) {
    return <p className="text-neutral-500">{strings.empty}</p>;
  }

  return <>{children(query.data)}</>;
}
