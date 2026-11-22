import type { Metadata, Viewport } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";
import { Suspense } from "react";
import { publicEnv } from "@/lib/env";
import { NavProgress } from "@/components/ui/NavProgress";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "GNS Jewellers — Gold, Diamond & Silver Jewellery", template: "%s · GNS Jewellers" },
  description: "Browse GNS Jewellers' catalogue of gold, diamond and silver jewellery with approximate prices, and enquire on WhatsApp.",
  icons: { icon: "/icons/lotus-logo.svg" },
};

export const viewport: Viewport = { themeColor: "#540404", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
