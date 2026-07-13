"use client";

import { useQuery, useQueries } from "@tanstack/react-query";
import type { Config, ProjectState, RoundState } from "@/contract/src";
import { Tier } from "@/contract/src";
import { contractClient } from "./contract";
import {
  fetchCampaignActivity,
  fetchCampaignContributions,
  fetchContributions,
  type CampaignActivity,
  type CampaignContribution,
  type Contribution,
} from "./events";

/**
 * The global role/token config (`admin`/`curator`/`attester`/`token`) in one call — the operator
 * console reads it to gate itself to a role-holder and to decide which of the five privileged
 * actions the connected wallet may sign. Rarely changes, so no polling.
 */
export function useConfig() {
  return useQuery<Config>({
    queryKey: ["config"],
    queryFn: async () => (await contractClient.get_config()).result,
    staleTime: 60_000,
  });
}

/** Every matching round ("season") ever opened — powers `/seasons` and the round archive. */
export function useRounds() {
  return useQuery<RoundState[]>({
    queryKey: ["rounds"],
    queryFn: async () => (await contractClient.list_rounds()).result,
    refetchInterval: 4000,
  });
}

/**
 * The single currently-`Open` round (the single-open invariant), resolved from
 * `open_round_id()` → `get_round`. `null` when no round is open — callers render the
 * "no active matching round" banner. Two RPC hops behind one cache key.
 */
export function useOpenRound() {
  return useQuery<RoundState | null>({
    queryKey: ["openRound"],
    queryFn: async () => {
      const id = (await contractClient.open_round_id()).result;
      if (id === undefined || id === null) return null;
      return (await contractClient.get_round({ id })).result;
    },
    refetchInterval: 4000,
  });
}

/** Full state of every campaign (all statuses); discovery filters to `Approved` client-side. */
export function useCampaigns() {
  return useQuery<ProjectState[]>({
    queryKey: ["campaigns"],
    queryFn: async () => (await contractClient.list_projects()).result,
    refetchInterval: 4000,
  });
}

/**
 * One campaign's state; throws (Error state) on an unknown id — the contract panics.
 * `enabled: false` for malformed ids keeps NaN out of the wire call, and a single retry
 * (instead of react-query's default 3× backoff) keeps the not-found render fast.
 */
export function useCampaign(id: number, enabled = true) {
  return useQuery<ProjectState>({
    queryKey: ["campaign", id],
    queryFn: async () => (await contractClient.get_project({ id })).result,
    refetchInterval: 4000,
    enabled,
    retry: 1,
  });
}

/** Fetch behavior for round-scoped reads. `frozen` = fetch once, never repoll — the contract
 * stores a Finalized round's split (`RoundMatched`) immutably, so final figures must not be
 * able to drift on screen ("numbers never jitter"). */
interface RoundReadOpts {
  enabled?: boolean;
  frozen?: boolean;
}

/**
 * Projected QF split for a given round: `[project_id, matched]` pairs. Live (4s poll) for the
 * open round; pass `frozen: true` for Finalized rounds so the stored, authoritative split is
 * read exactly once. Pass a `null` round id to skip the app's most expensive read.
 */
export function usePreviewRound(
  roundId: number | null | undefined,
  { enabled = true, frozen = false }: RoundReadOpts = {},
) {
  return useQuery<Array<readonly [number, bigint]>>({
    queryKey: ["previewRound", roundId],
    queryFn: async () => (await contractClient.preview_round({ round_id: roundId! })).result,
    refetchInterval: frozen ? false : 4000,
    staleTime: frozen ? Infinity : 0,
    enabled: enabled && roundId !== null && roundId !== undefined,
  });
}

/**
 * Per-(round, project) tally `(direct, donors, matched, claimed)` — the only place a *donor
 * count* is exposed (there is no lifetime count on-chain). Discovery uses it for the "this round"
 * stat on in-scope cards; `enabled` gates it so out-of-scope campaigns issue no wasted RPC.
 */
export function useRoundProject(
  roundId: number | null | undefined,
  projectId: number,
  { enabled = true, frozen = false }: RoundReadOpts = {},
) {
  return useQuery<readonly [bigint, number, bigint, boolean]>({
    queryKey: ["roundProject", roundId, projectId],
    queryFn: async () =>
      (await contractClient.round_project({ round_id: roundId!, project_id: projectId })).result,
    refetchInterval: frozen ? false : 4000,
    staleTime: frozen ? Infinity : 0,
    enabled: enabled && roundId !== null && roundId !== undefined,
  });
}

/**
 * Batch of per-(round, project) tallies for a set of campaigns in one round — the `/results`
 * reveal reads `direct`/`donors` here (the green matched bar comes from `preview_round`). Shares
 * the exact `["roundProject", round, project]` cache keys with `useRoundProject`, so a card and the
 * results page never double-fetch the same tally. Returns react-query results in `projectIds` order.
 */
export function useRoundProjects(
  roundId: number | null | undefined,
  projectIds: number[],
  { frozen = false }: RoundReadOpts = {},
) {
  return useQueries({
    queries: projectIds.map((projectId) => ({
      queryKey: ["roundProject", roundId, projectId],
      queryFn: async () =>
        (await contractClient.round_project({ round_id: roundId!, project_id: projectId })).result,
      enabled: roundId !== null && roundId !== undefined,
      refetchInterval: frozen ? false : 4000,
      staleTime: frozen ? Infinity : 0,
    })),
  });
}

/**
 * The on-chain verification tier for `who` (None/Basic/Institution) — the only KYC state the
 * contract exposes. Gates contribute (≥ Basic) and fund_pool (Institution); powers the tier badge.
 */
export function useTier(who: string | null) {
  return useQuery<Tier>({
    queryKey: ["tier", who],
    queryFn: async () => (await contractClient.verification_tier({ who: who! })).result,
    enabled: !!who,
    refetchInterval: 4000,
  });
}

/**
 * The connected wallet's own contribution history, reconstructed from `contrib` events over RPC
 * (`lib/events.ts`) — powers `/account`. A full event scan is heavier than a view call, so this
 * polls slower (8s) than the 4s chain-state hooks; a fresh gift shows within one interval.
 */
export function useContributions(who: string | null) {
  return useQuery<Contribution[]>({
    queryKey: ["contributions", who],
    queryFn: async () => fetchContributions(who!),
    enabled: !!who,
    refetchInterval: 8000,
  });
}

/**
 * One campaign's full public money trail — `contrib` (donations in) and `payout` (funds released
 * to the owner) events by project-id topic. Powers the interactive activity feed under the campaign
 * story. Same event-scan weight as `useContributions`, so the same slower 8s poll.
 */
export function useCampaignActivity(projectId: number, enabled = true) {
  return useQuery<CampaignActivity[]>({
    queryKey: ["campaignActivity", projectId],
    queryFn: async () => fetchCampaignActivity(projectId),
    enabled,
    refetchInterval: 8000,
  });
}

/**
 * The donations one campaign received (`contrib` events by project-id topic) — powers the
 * dashboard's per-campaign insights. Same event-scan weight as `useContributions`, so the same
 * slower 8s poll.
 */
export function useCampaignContributions(projectId: number, enabled = true) {
  return useQuery<CampaignContribution[]>({
    queryKey: ["campaignContributions", projectId],
    queryFn: async () => fetchCampaignContributions(projectId),
    enabled,
    refetchInterval: 8000,
  });
}
