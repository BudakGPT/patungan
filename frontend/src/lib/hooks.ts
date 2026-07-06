"use client";

import { useQuery } from "@tanstack/react-query";
import type { Config, ProjectState } from "@/contract/src";
import { contractClient } from "./contract";

/** Round config: pool, admin, token, round_end, status (§4.3, §6.2 live poll). */
export function useRound() {
  return useQuery<Config>({
    queryKey: ["round"],
    queryFn: async () => (await contractClient.get_config()).result,
    refetchInterval: 4000,
  });
}

/** Full state of every registered project, in registration order (§4.3). */
export function useProjects() {
  return useQuery<ProjectState[]>({
    queryKey: ["projects"],
    queryFn: async () => (await contractClient.list_projects()).result,
    refetchInterval: 4000,
  });
}

/**
 * One project's state; throws (Error state) on an unknown id — the contract panics (§4.3).
 * `enabled: false` for malformed ids keeps NaN out of the wire call, and a single retry
 * (instead of react-query's default 3× backoff) keeps the not-found render fast.
 */
export function useProject(id: number, enabled = true) {
  return useQuery<ProjectState>({
    queryKey: ["project", id],
    queryFn: async () => (await contractClient.get_project({ id })).result,
    refetchInterval: 4000,
    enabled,
    retry: 1,
  });
}

/** Whether `who` is in the verified-address registry (§4.3) — powers the E1 badge. */
export function useIsVerified(who: string | null) {
  return useQuery<boolean>({
    queryKey: ["isVerified", who],
    queryFn: async () => (await contractClient.is_verified({ who: who! })).result,
    enabled: !!who,
    refetchInterval: 4000,
  });
}

/** Live projected QF split on current state; empty array pre-contribution (§10). */
export function usePreviewMatch() {
  return useQuery<Array<readonly [number, bigint]>>({
    queryKey: ["previewMatches"],
    queryFn: async () => (await contractClient.preview_matches()).result,
    refetchInterval: 4000,
  });
}
