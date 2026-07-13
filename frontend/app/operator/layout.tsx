import type { Metadata } from "next";
import { LocalizedTitle } from "@/components/LocalizedTitle";

export const metadata: Metadata = { title: "Konsol Operator" };

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocalizedTitle page="operator" />
      {children}
    </>
  );
}
