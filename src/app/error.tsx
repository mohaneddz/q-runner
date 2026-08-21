"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No error service is wired up; the console is what a player can actually
    // copy out of if they report something.
    console.error(error);
  }, [error]);

  return (
    <main className="appShell stack">
      <section className="panel pad stack" style={{ maxWidth: 560 }}>
        <h1>That broke</h1>
        <p className="muted">
          This page failed to render. Your saved levels and progress live in this browser&apos;s
          storage and are untouched — retrying, or heading back to the level list, should get you
          moving again.
        </p>
        {error.digest ? <p className="muted small">Reference: {error.digest}</p> : null}
        <div className="toolRowActions">
          <button type="button" className="btn btnPrimary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
