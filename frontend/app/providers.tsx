"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WalletProvider } from "@/lib/wallet";
import { LocaleProvider } from "@/lib/locale";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchInterval: 4000 },
        },
      }),
  );

  return (
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>{children}</WalletProvider>
      </QueryClientProvider>
    </LocaleProvider>
  );
}
