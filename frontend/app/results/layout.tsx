import type { Metadata } from "next";
import { LocalizedTitle } from "@/components/LocalizedTitle";

export const metadata: Metadata = {
  title: "Hasil Pencocokan",
  description: "Lihat pembagian dana pendamping yang dihitung secara transparan setiap musim.",
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LocalizedTitle page="results" />
      {children}
    </>
  );
}
