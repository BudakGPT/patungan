"use client";

import { useQuery } from "@tanstack/react-query";
import type { Config, ProjectState } from "@/contract/dist/index.js";
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

/** One project's state; throws (Error state) on an unknown id — the contract panics (§4.3). */
export function useProject(id: number) {
  return useQuery<ProjectState>({
    queryKey: ["project", id],
    queryFn: async () => (await contractClient.get_project({ id })).result,
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
