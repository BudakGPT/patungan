import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletProvider, useWallet } from "@/lib/wallet";

/**
 * Rehydration/reconnect audit (P3): the critique once caught the header stuck on the connect prompt
 * while queries hung, so the state machine — mount rehydration, connect, user-rejection vs genuine
 * failure, network switches via the watcher, disconnect — is pinned here. `lib/freighter` (the thin
 * Freighter wrapper) and the change watcher are mocked; `config.network` is "TESTNET" (vitest env).
 */
const f = vi.hoisted(() => ({
  isFreighterInstalled: vi.fn(),
  getAllowedAddress: vi.fn(),
  getFreighterNetwork: vi.fn(),
  requestFreighterAccess: vi.fn(),
  watchCb: null as null | ((v: { address: string; network: string }) => void),
  watchStop: vi.fn(),
}));

vi.mock("@/lib/freighter", () => ({
  isFreighterInstalled: f.isFreighterInstalled,
  getAllowedAddress: f.getAllowedAddress,
  getFreighterNetwork: f.getFreighterNetwork,
  requestFreighterAccess: f.requestFreighterAccess,
}));

vi.mock("@stellar/freighter-api", () => ({
  WatchWalletChanges: class {
    constructor(_intervalMs: number) {}
    watch(cb: (v: { address: string; network: string }) => void) {
      f.watchCb = cb;
    }
    stop() {
      f.watchStop();
    }
  },
}));

const ADDR = "GDONORADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

function Probe() {
  const { status, address, canWrite, connectError, connect, disconnect } = useWallet();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="address">{address ?? "-"}</span>
      <span data-testid="canWrite">{String(canWrite)}</span>
      <span data-testid="err">{connectError ?? "-"}</span>
      <button type="button" onClick={() => void connect()}>
        connect
      </button>
      <button type="button" onClick={() => disconnect()}>
        disconnect
      </button>
    </div>
  );
}

function renderWallet() {
  return render(
    <WalletProvider>
      <Probe />
    </WalletProvider>,
  );
}

const status = () => screen.getByTestId("status").textContent;

beforeEach(() => {
  f.watchCb = null;
  f.isFreighterInstalled.mockReset();
  f.getAllowedAddress.mockReset();
  f.getFreighterNetwork.mockReset();
  f.requestFreighterAccess.mockReset();
  f.watchStop.mockReset();
  // Sensible default: installed, network TESTNET, no prior grant.
  f.isFreighterInstalled.mockResolvedValue(true);
  f.getAllowedAddress.mockResolvedValue({ address: null, error: null });
  f.getFreighterNetwork.mockResolvedValue("TESTNET");
  f.requestFreighterAccess.mockResolvedValue({ address: ADDR, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WalletProvider rehydration on mount", () => {
  it("rehydrates a previously-granted wallet to connected", async () => {
    f.getAllowedAddress.mockResolvedValue({ address: ADDR, error: null });
    renderWallet();
    await waitFor(() => expect(status()).toBe("connected"));
    expect(screen.getByTestId("address")).toHaveTextContent(ADDR);
    expect(screen.getByTestId("canWrite")).toHaveTextContent("true");
  });

  it("reports not-installed when Freighter is absent", async () => {
    f.isFreighterInstalled.mockResolvedValue(false);
    renderWallet();
    await waitFor(() => expect(status()).toBe("not-installed"));
  });

  it("stays disconnected when installed but never granted", async () => {
    renderWallet();
    await waitFor(() => expect(status()).toBe("disconnected"));
    expect(screen.getByTestId("canWrite")).toHaveTextContent("false");
  });

  it("flags wrong-network when the rehydrated network isn't the configured one", async () => {
    f.getAllowedAddress.mockResolvedValue({ address: ADDR, error: null });
    f.getFreighterNetwork.mockResolvedValue("PUBLIC");
    renderWallet();
    await waitFor(() => expect(status()).toBe("wrong-network"));
    expect(screen.getByTestId("canWrite")).toHaveTextContent("false");
  });
});

describe("WalletProvider connect", () => {
  it("connects on a granted access request", async () => {
    renderWallet();
    await waitFor(() => expect(status()).toBe("disconnected"));
    await userEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(status()).toBe("connected"));
    expect(screen.getByTestId("address")).toHaveTextContent(ADDR);
  });

  it("stays silent on user rejection (no connectError)", async () => {
    f.requestFreighterAccess.mockResolvedValue({ address: null, error: "User declined access" });
    renderWallet();
    await waitFor(() => expect(status()).toBe("disconnected"));
    await userEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(status()).toBe("disconnected"));
    expect(screen.getByTestId("err")).toHaveTextContent("-");
  });

  it("surfaces a genuine connect failure", async () => {
    f.requestFreighterAccess.mockResolvedValue({ address: null, error: "extension unreachable" });
    renderWallet();
    await waitFor(() => expect(status()).toBe("disconnected"));
    await userEvent.click(screen.getByText("connect"));
    await waitFor(() =>
      expect(screen.getByTestId("err")).toHaveTextContent("extension unreachable"),
    );
    expect(status()).toBe("disconnected");
  });
});

describe("WalletProvider live watcher + disconnect", () => {
  it("flips to wrong-network when the account switches networks in-session", async () => {
    f.getAllowedAddress.mockResolvedValue({ address: ADDR, error: null });
    renderWallet();
    await waitFor(() => expect(status()).toBe("connected"));
    await waitFor(() => expect(f.watchCb).not.toBeNull());
    act(() => f.watchCb!({ address: ADDR, network: "PUBLIC" }));
    await waitFor(() => expect(status()).toBe("wrong-network"));
  });

  it("drops to disconnected when access is revoked (watched address empties)", async () => {
    f.getAllowedAddress.mockResolvedValue({ address: ADDR, error: null });
    renderWallet();
    await waitFor(() => expect(status()).toBe("connected"));
    await waitFor(() => expect(f.watchCb).not.toBeNull());
    act(() => f.watchCb!({ address: "", network: "TESTNET" }));
    await waitFor(() => expect(status()).toBe("disconnected"));
  });

  it("clears state on explicit disconnect", async () => {
    f.getAllowedAddress.mockResolvedValue({ address: ADDR, error: null });
    renderWallet();
    await waitFor(() => expect(status()).toBe("connected"));
    await userEvent.click(screen.getByText("disconnect"));
    await waitFor(() => expect(status()).toBe("disconnected"));
    expect(screen.getByTestId("address")).toHaveTextContent("-");
  });
});
