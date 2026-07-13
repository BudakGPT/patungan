import type { Metadata } from "next";
import { LocalizedTitle } from "@/components/LocalizedTitle";

export const metadata: Metadata = { title: "Musim Pencocokan" };

export default function SeasonsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocalizedTitle page="seasons" />
      {children}
    </>
  );
}
