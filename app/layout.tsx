import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/** Self-hosted at build time (Next downloads and serves the font files itself — no runtime request to Google), set as --font-inter and wired into --font-sans in globals.css. A real grotesque in place of the system UI font, used site-wide. */
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Trace — R&D Project Capture",
  description: "The evidence record for R&D, captured weekly.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
