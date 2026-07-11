import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // config.ts calls required() on these at import; component tests pull it in via ExplorerLink.
    env: {
      NEXT_PUBLIC_NETWORK: "TESTNET",
      NEXT_PUBLIC_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      NEXT_PUBLIC_CONTRACT_ID: "CBXIWGXBR5SZWT65N4EAXXSRHH54YYYDGTZNOOUB5NRJ4HZJXIQUR3ZN",
      NEXT_PUBLIC_TOKEN_ID: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet",
      NEXT_PUBLIC_ADMIN_ADDRESS: "GBO6MF56C7EWFCXX2FNL4OTECCHD2K6CLKXN7ROQVYDWKJWVXUUHJVP6",
    },
  },
});
