// Import the generated bindings' TS source (compiled by Next), not its dist/ build —
// dist is git-ignored, so a clean clone must not depend on it.
import { Client } from "@/contract/src";
import { config } from "./config";

/** Single shared read/write client over the deployed contract. */
export const contractClient = new Client({
  contractId: config.contractId,
  networkPassphrase: config.networkPassphrase,
  rpcUrl: config.sorobanRpcUrl,
});
