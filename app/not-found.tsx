import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center">
      <p className="text-sm text-muted-foreground">MENTORA AI · 404</p>
      <h1 className="text-3xl font-semibold">
        This page isn’t in your study plan.
      </h1>
      <p className="text-muted-foreground">
        Check the address or open your dashboard to continue.
      </p>
      <Link
        className="rounded-lg bg-primary px-5 py-3 text-primary-foreground"
        href="/dashboard"
      >
        Open dashboard
      </Link>
      <Link href="/" className="underline">
        Back to home
      </Link>
    </main>
  );
}
