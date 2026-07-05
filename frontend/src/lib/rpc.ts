import { rpc } from "@stellar/stellar-sdk";
import { config } from "./config";

export const server = new rpc.Server(config.sorobanRpcUrl);
