/**
 * Session-scoped heuristic for "is this wallet's first contribution to this project?"
 * (drives the optimistic `donor_count` bump). The contract only exposes an aggregate
 * `donor_count`, not a per-donor lookup, so this in-memory set is the cheapest available
 * signal; a page reload starts empty, which only matters if the same wallet had already
 * contributed in an earlier session — harmless for the single live demo chip-in.
 */
const contributed = new Set<string>();

function key(projectId: number, address: string): string {
  return `${projectId}:${address}`;
}

export function hasContributed(projectId: number, address: string): boolean {
  return contributed.has(key(projectId, address));
}

export function markContributed(projectId: number, address: string): void {
  contributed.add(key(projectId, address));
}
