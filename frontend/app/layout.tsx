import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

/**
 * One grotesque carries the whole system (body 400 → display 900, with the width
 * axis for hero type); mono is reserved for on-chain artifacts. Self-hosted via
 * next/font so the demo never depends on a font CDN.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  applicationName: "Patungan",
  title: {
    default: "Patungan | gotong royong on-chain",
    template: "%s | Patungan",
  },
  description:
    "Patungan membantu banyak donasi kecil menarik dana pendamping secara transparan di Stellar Testnet.",
  keywords: [
    "Patungan",
    "quadratic funding",
    "gotong royong",
    "donasi",
    "crowdfunding",
    "matching funds",
    "Stellar",
    "Soroban",
  ],
  authors: [{ name: "Patungan" }],
  openGraph: {
    type: "website",
    siteName: "Patungan",
    title: "Patungan | gotong royong on-chain",
    description:
      "Banyak donasi kecil menarik dana pendamping secara transparan di Stellar Testnet.",
    locale: "id_ID",
    alternateLocale: ["en_US", "fil_PH", "vi_VN"],
    images: [{ url: "/assets/patungan-logo.png", width: 1024, height: 1024, alt: "Patungan" }],
  },
  twitter: {
    card: "summary",
    title: "Patungan | gotong royong on-chain",
    description:
      "Banyak donasi kecil menarik dana pendamping secara transparan di Stellar Testnet.",
    images: ["/assets/patungan-logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body className="grain font-sans">
        <div className="spotlight" />
        <Providers>
          <div className="relative z-10 flex min-h-screen flex-col">
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
