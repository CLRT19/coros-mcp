import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COROS Pulse — WHOOP-style coach",
  description:
    "A WHOOP-style recovery, strain and sleep dashboard with a built-in AI coach, powered by your COROS training data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-slate-100">{children}</body>
    </html>
  );
}
