import Link from "next/link";
import { SiteNav } from "@/components/ui/SiteNav";

export default function NotFound() {
  return (
    <main className="appShell stack">
      <SiteNav />
      <section className="panel pad stack" style={{ maxWidth: 560 }}>
        <h1>Nothing here</h1>
        <p className="muted">
          That route does not exist. The level you were after may have been deleted from this
          browser&apos;s storage.
        </p>
        <div className="toolRowActions">
          <Link href="/levels" className="btn btnPrimary">
            Browse levels
          </Link>
          <Link href="/" className="btn">
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}
