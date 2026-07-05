import { Client } from "@/contract/dist/index.js";
import { config } from "./config";

/** Single shared read/write client over the deployed contract (§4.3). */
export const contractClient = new Client({
  contractId: config.contractId,
  networkPassphrase: config.networkPassphrase,
  rpcUrl: config.sorobanRpcUrl,
});
