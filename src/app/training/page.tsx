import Link from "next/link";
import { TrainingPanel } from "@/components/training/TrainingPanel";

export default function TrainingPage() {
  return (
    <main className="app-shell" style={{ padding: "20px 0", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Training</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/" className="btn">Home</Link>
          <Link href="/play" className="btn">Play</Link>
          <Link href="/editor" className="btn">Editor</Link>
        </div>
      </div>
      <TrainingPanel />
    </main>
  );
}
