"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { WatchWalletChanges } from "@stellar/freighter-api";
import { config } from "./config";
import {
  getAllowedAddress,
  getFreighterNetwork,
  isFreighterInstalled,
  requestFreighterAccess,
} from "./freighter";

export type WalletStatus =
  | "not-installed"
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong-network";

interface WalletState {
  status: WalletStatus;
  address: string | null;
  network: string | null;
  /** True only when a wallet is connected and on the configured network — gates write buttons (E2). */
  canWrite: boolean;
  /** Set when a connect attempt genuinely failed (not a user rejection). */
  connectError: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isFreighterInstalled();
      if (cancelled) return;
      setInstalled(ok);
      if (!ok) return;

      const { address: allowedAddress } = await getAllowedAddress();
      if (cancelled || !allowedAddress) return;
      setAddress(allowedAddress);
      setNetwork(await getFreighterNetwork());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // E2: keep address/network live after connect — Freighter account or network switches
  // must flip `canWrite`/`NetworkBanner` without a page reload. The watcher polls the
  // extension; an empty watched address while connected means access was revoked.
  useEffect(() => {
    if (installed !== true) return;
    const watcher = new WatchWalletChanges(3000);
    watcher.watch(({ address: watchedAddress, network: watchedNetwork }) => {
      if (watchedNetwork) setNetwork(watchedNetwork);
      setAddress((prev) => (prev ? watchedAddress || null : prev));
    });
    return () => watcher.stop();
  }, [installed]);

  const connect = useCallback(async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const { address: connectedAddress, error } = await requestFreighterAccess();
      if (!connectedAddress) {
        // A user rejection stays silent (B1 edge case); a genuine failure must not.
        if (error && !/reject|declin|cancel|denied/i.test(error)) {
          setConnectError(error);
        }
        return;
      }
      setAddress(connectedAddress);
      setNetwork(await getFreighterNetwork());
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
    setConnectError(null);
  }, []);

  const status: WalletStatus = useMemo(() => {
    if (installed === false) return "not-installed";
    if (connecting) return "connecting";
    if (!address) return "disconnected";
    if (network && network !== config.network) return "wrong-network";
    return "connected";
  }, [installed, connecting, address, network]);

  const value = useMemo<WalletState>(
    () => ({
      status,
      address,
      network,
      canWrite: status === "connected",
      connectError,
      connect,
      disconnect,
    }),
    [status, address, network, connectError, connect, disconnect],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
