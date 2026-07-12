import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jelajahi Kampanye",
  description: "Temukan kampanye terverifikasi dan dukung proyek yang paling berarti bagimu.",
};

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
