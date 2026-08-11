import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trace — R&D Project Capture",
  description: "The evidence record for R&D, captured weekly.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
