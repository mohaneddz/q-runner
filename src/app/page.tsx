import Link from "next/link";

export default function HomePage() {
  return (
    <main className="app-shell" style={{ padding: "32px 0" }}>
      <section className="panel" style={{ padding: 20 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>Q-Runner</h1>
        <p style={{ color: "var(--muted)" }}>
          Fast deterministic side-scroller with level editor and Q-learning training mode.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/play" className="btn">
            Play
          </Link>
          <Link href="/editor" className="btn">
            Level Editor
          </Link>
          <Link href="/training" className="btn">
            Training
          </Link>
        </div>
      </section>
    </main>
  );
}
