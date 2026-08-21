"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/levels", label: "Levels" },
  { href: "/endless", label: "Endless" },
  { href: "/editor", label: "Editor" },
  { href: "/training", label: "Training" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="siteNav">
      <Link href="/" className="brand">
        Q<span>-Runner</span>
      </Link>
      <nav aria-label="Main">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`navLink ${pathname.startsWith(link.href) ? "navLinkActive" : ""}`}
            aria-current={pathname.startsWith(link.href) ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
