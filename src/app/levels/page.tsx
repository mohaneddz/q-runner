import type { Metadata } from "next";
import { LevelBrowser } from "@/components/levels/LevelBrowser";
import { SiteNav } from "@/components/ui/SiteNav";

export const metadata: Metadata = {
  title: "Levels",
  description:
    "The ten built-in Q-Runner levels plus anything you have built, with your best progress on each.",
  alternates: { canonical: "/levels" },
};

export default function LevelsPage() {
  return (
    <main className="appShell stack">
      <SiteNav />
      <h1>Levels</h1>
      <LevelBrowser />
    </main>
  );
}
