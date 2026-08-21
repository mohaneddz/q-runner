import type { Metadata } from "next";
import { EndlessClient } from "@/components/endless/EndlessClient";

export const metadata: Metadata = {
  title: "Endless",
  description:
    "An endless Q-Runner run. Every stage is generated on the fly and verified clearable before you play it.",
  // The seed is a share link, not a distinct page.
  alternates: { canonical: "/endless" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EndlessPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = params.seed;
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  const seed = Number.isFinite(value) ? value >>> 0 : undefined;

  return <EndlessClient initialSeed={seed} />;
}
