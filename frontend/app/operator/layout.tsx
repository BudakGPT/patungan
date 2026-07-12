import type { Metadata } from "next";

export const metadata: Metadata = { title: "Konsol Operator" };

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
