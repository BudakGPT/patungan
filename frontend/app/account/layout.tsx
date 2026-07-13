import type { Metadata } from "next";
import { LocalizedTitle } from "@/components/LocalizedTitle";

export const metadata: Metadata = { title: "Kontribusi Saya" };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocalizedTitle page="account" />
      {children}
    </>
  );
}
