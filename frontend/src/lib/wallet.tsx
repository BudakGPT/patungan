"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { address: connectedAddress } = await requestFreighterAccess();
      // A rejected/failed request leaves address null — back to idle, no error toast (B1 edge case).
      if (!connectedAddress) return;
      setAddress(connectedAddress);
      setNetwork(await getFreighterNetwork());
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetwork(null);
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
      connect,
      disconnect,
    }),
    [status, address, network, connect, disconnect],
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
