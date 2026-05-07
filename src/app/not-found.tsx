import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-bold text-slate-700">404</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-300">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        The constituency or page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg border border-dashboard-border bg-dashboard-surface px-4 py-2 text-sm text-slate-300 hover:border-slate-400"
      >
        Back to overview
      </Link>
    </div>
  );
}
