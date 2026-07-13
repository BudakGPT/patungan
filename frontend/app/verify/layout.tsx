import type { Metadata } from "next";
import { LocalizedTitle } from "@/components/LocalizedTitle";

export const metadata: Metadata = { title: "Verifikasi Wallet" };

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocalizedTitle page="verify" />
      {children}
    </>
  );
}
