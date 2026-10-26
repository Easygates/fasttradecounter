import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Picklane — Warehouse Picking Requests", template: "%s · Picklane" },
  description: "A smoother handoff from trade counter to warehouse. Live picking requests, private screenshots, and one connected team.",
  applicationName: "Picklane", robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#172a22" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
