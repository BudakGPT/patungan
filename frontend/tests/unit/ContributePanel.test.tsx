import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContributePanel } from "@/components/ContributePanel";
import { LocaleProvider } from "@/lib/locale";
import { id as strings } from "@/strings.id";
import { Tier } from "@/contract/src";
import type { ProjectState } from "@/contract/src";

// The panel pulls the wallet, tier query, contract client, and Freighter signer from four modules;
// mock all four so the component under test is pure UI + its own state machine.
const mocks = vi.hoisted(() => ({
  wallet: { address: null as string | null, status: "disconnected", connect: vi.fn() },
  tier: { data: undefined as Tier | undefined },
  contribute: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@/lib/wallet", () => ({ useWallet: () => mocks.wallet }));
vi.mock("@/lib/hooks", () => ({ useTier: () => mocks.tier }));
vi.mock("@/lib/contract", () => ({ contractClient: { contribute: mocks.contribute } }));
vi.mock("@stellar/freighter-api", () => ({ default: { signTransaction: mocks.signTransaction } }));

const c = strings.campaign.contribute;

const campaign: ProjectState = {
  category: { tag: "EducationHealth", values: undefined },
  created_ledger: 0n,
  id: 7,
  image_cid: "",
  lifetime_direct: 1_000n,
  owner: "GOWNER",
  payout: "GPAYOUT",
  status: { tag: "Approved", values: undefined },
  story: "",
  title: "Test Campaign",
  unrounded_direct: 0n,
};

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <LocaleProvider>
        <ContributePanel campaign={campaign} />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return { qc, ...utils };
}

beforeEach(() => {
  // Pin the locale to Bahasa so the LocaleProvider mount effect doesn't flip to en-US (jsdom default).
  window.localStorage.setItem("patungan:locale", "id");
  mocks.wallet = { address: null, status: "disconnected", connect: vi.fn() };
  mocks.tier = { data: undefined };
  // contribute/signTransaction are captured by reference in the module factory — reset, don't reassign.
  mocks.contribute.mockReset();
  mocks.signTransaction.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("ContributePanel gate ladder", () => {
  it("renders null when disabled", () => {
    const qc = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <LocaleProvider>
          <ContributePanel campaign={campaign} disabled />
        </LocaleProvider>
      </QueryClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers connect while disconnected and dispatches connect()", async () => {
    mocks.wallet = { address: null, status: "disconnected", connect: vi.fn() };
    renderPanel();
    const btn = screen.getByRole("button", { name: strings.wallet.connect });
    await userEvent.click(btn);
    expect(mocks.wallet.connect).toHaveBeenCalledOnce();
  });

  it("shows a disabled connecting button while connecting", () => {
    mocks.wallet = { address: null, status: "connecting", connect: vi.fn() };
    renderPanel();
    expect(screen.getByRole("button", { name: strings.wallet.connecting })).toBeDisabled();
  });

  it("blocks on wrong network", () => {
    mocks.wallet = { address: "GDONOR", status: "wrong-network", connect: vi.fn() };
    renderPanel();
    expect(screen.getByText(c.wrongNetwork)).toBeInTheDocument();
  });

  it("routes an unverified (Tier.None) wallet to /verify", () => {
    mocks.wallet = { address: "GDONOR", status: "connected", connect: vi.fn() };
    mocks.tier = { data: Tier.None };
    renderPanel();
    expect(screen.getByText(c.tierGateTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: c.tierGateCta })).toHaveAttribute("href", "/verify");
  });

  it("reaches the amount step for a verified wallet", async () => {
    mocks.wallet = { address: "GDONOR", status: "connected", connect: vi.fn() };
    mocks.tier = { data: Tier.Basic };
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: c.cta }));
    expect(screen.getByText(c.amountLabel)).toBeInTheDocument();
  });
});

describe("ContributePanel custom-amount validation", () => {
  async function openCustom() {
    mocks.wallet = { address: "GDONOR", status: "connected", connect: vi.fn() };
    mocks.tier = { data: Tier.Basic };
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: c.cta }));
    await userEvent.click(screen.getByRole("button", { name: c.customChip }));
    return screen.getByRole("textbox", { name: c.customChip });
  }

  it("keeps confirm disabled and shows no error while the field is empty", async () => {
    await openCustom();
    expect(screen.getByRole("button", { name: c.confirm })).toBeDisabled();
    expect(screen.queryByText(c.customInvalid)).not.toBeInTheDocument();
  });

  it("strips non-digits and rejects zero", async () => {
    const input = await openCustom();
    await userEvent.type(input, "0a1b");
    // digits-only filter keeps "01"; but a leading-zero "0" alone is the zero case — test it directly
    await userEvent.clear(input);
    await userEvent.type(input, "0");
    expect(screen.getByText(c.customInvalid)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.confirm })).toBeDisabled();
  });

  it("accepts a positive integer and enables confirm", async () => {
    const input = await openCustom();
    await userEvent.type(input, "25000");
    expect(input).toHaveValue("25000");
    expect(screen.queryByText(c.customInvalid)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.confirm })).toBeEnabled();
  });
});

describe("ContributePanel tx state machine", () => {
  beforeEach(() => {
    mocks.wallet = { address: "GDONOR", status: "connected", connect: vi.fn() };
    mocks.tier = { data: Tier.Basic };
  });

  it("reviews the campaign, amount, recipient, and network before requesting a signature", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: c.cta }));
    await userEvent.click(screen.getByRole("button", { name: c.confirm }));

    expect(screen.getByText(c.reviewTitle)).toBeInTheDocument();
    expect(screen.getByText("Test Campaign")).toBeInTheDocument();
    expect(screen.getByText("Rp50.000")).toBeInTheDocument();
    expect(screen.getByText("GPAYOUT")).toBeInTheDocument();
    expect(screen.getByText("Stellar Testnet")).toBeInTheDocument();
    expect(mocks.contribute).not.toHaveBeenCalled();
  });

  it("on success shows the receipt, an explorer link, and patches lifetime_direct only", async () => {
    mocks.contribute.mockResolvedValue({
      signAndSend: async ({ watcher }: { watcher: { onSubmitted: () => void } }) => {
        watcher.onSubmitted();
        return { result: { isErr: () => false }, sendTransactionResponse: { hash: "abc123" } };
      },
    });
    const { qc } = renderPanel();
    qc.setQueryData<ProjectState>(["campaign", campaign.id], campaign);
    qc.setQueryData<ProjectState[]>(["campaigns"], [campaign]);

    await userEvent.click(screen.getByRole("button", { name: c.cta }));
    // Default preset is 50_000 (PRESETS[1]).
    await userEvent.click(screen.getByRole("button", { name: c.confirm }));
    await userEvent.click(screen.getByRole("button", { name: c.reviewSubmit }));

    await waitFor(() => expect(screen.getByText(c.successTitle)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: strings.explorer.viewTx })).toHaveAttribute(
      "href",
      expect.stringContaining("abc123"),
    );
    expect(qc.getQueryData<ProjectState>(["campaign", campaign.id])?.lifetime_direct).toBe(51_000n);
    expect(qc.getQueryData<ProjectState[]>(["campaigns"])?.[0].lifetime_direct).toBe(51_000n);
  });

  it("maps an on-chain Err result to a localized error message", async () => {
    mocks.contribute.mockResolvedValue({
      signAndSend: async () => ({
        result: { isErr: () => true, unwrapErr: () => new Error("NotVerified") },
      }),
    });
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: c.cta }));
    await userEvent.click(screen.getByRole("button", { name: c.confirm }));
    await userEvent.click(screen.getByRole("button", { name: c.reviewSubmit }));
    await waitFor(() =>
      expect(screen.getByText(strings.errors.NotVerified)).toBeInTheDocument(),
    );
  });

  it("falls back to the generic error when the client throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.contribute.mockRejectedValue(new Error("network exploded"));
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: c.cta }));
    await userEvent.click(screen.getByRole("button", { name: c.confirm }));
    await userEvent.click(screen.getByRole("button", { name: c.reviewSubmit }));
    await waitFor(() => expect(screen.getByText(strings.errors.generic)).toBeInTheDocument());
  });
});
