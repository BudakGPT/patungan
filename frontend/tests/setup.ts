import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest has no globals enabled, so RTL's auto-cleanup never registers — unmount between tests
// ourselves, or component renders leak into each other's DOM.
afterEach(cleanup);
