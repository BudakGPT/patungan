/**
 * Demo/test artifacts that live on the shared testnet contract but must never read as product
 * content. The E2E suite registers campaigns titled "E2E smoke <timestamp>"; they stay visible on
 * the operator console (operators need to curate them) but are filtered from every public surface
 * (discovery grid, hero match engine, results, seasons leaderboards).
 */
export function isDemoArtifact(title: string): boolean {
  return /^e2e smoke/i.test(title.trim());
}
