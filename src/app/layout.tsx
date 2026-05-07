import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "India Elections 2026 — Live Results Dashboard",
    template: "%s | India Elections 2026",
  },
  description:
    "Live results, constituency-wise data, and alliance simulation for the 2026 Indian Assembly Elections — Bihar, West Bengal, Assam, Kerala, Tamil Nadu.",
  openGraph: {
    type: "website",
    siteName: "India Elections 2026",
    title: "India Elections 2026 — Live Results Dashboard",
    description:
      "Live results and alliance simulator for 5 state assembly elections.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dashboard-bg">
        <header className="sticky top-0 z-50 border-b border-dashboard-border bg-dashboard-bg/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-orange-500 to-blue-500 text-xs font-bold text-white">
                IN
              </div>
              <span className="font-semibold text-slate-100">
                India Elections{" "}
                <span className="text-slate-400">2026</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="rounded px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-dashboard-surface hover:text-slate-100"
              >
                Overview
              </Link>
              <Link
                href="/simulator"
                className="rounded px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-dashboard-surface hover:text-slate-100"
              >
                Alliance Simulator
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>

        <footer className="mt-16 border-t border-dashboard-border">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <p className="text-center text-xs text-slate-500">
              Data sourced from the Election Commission of India (ECI) •{" "}
              <a
                href="https://results.eci.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-300 underline"
              >
                results.eci.gov.in
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
