import type { Metadata } from "next";
import { LocalizedTitle } from "@/components/LocalizedTitle";

export const metadata: Metadata = { title: "Dasbor Kampanye" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocalizedTitle page="dashboard" />
      {children}
    </>
  );
}
