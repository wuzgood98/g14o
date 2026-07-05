import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="mb-4 font-bold text-4xl tracking-tight">g14o</h1>
      <p className="mb-8 max-w-xl text-fd-muted-foreground text-lg">
        Documentation for the{" "}
        <code className="rounded-md bg-fd-muted px-1.5 py-0.5 text-sm">
          @g14o/*
        </code>{" "}
        npm packages — cache, rate limiting, env validation, and Paystack
        integrations.
      </p>
      <Link
        className="inline-flex items-center rounded-lg bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground text-sm transition-colors hover:opacity-90"
        href="/introduction"
      >
        Browse documentation
      </Link>
    </main>
  );
}
