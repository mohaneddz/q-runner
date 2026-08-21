import type { Metadata } from "next";
import { EditorClient } from "@/components/editor/EditorClient";

export const metadata: Metadata = {
  title: "Level editor",
  description:
    "Build Q-Runner levels on a snapped grid, then check them against the same solver the built-in levels pass.",
  alternates: { canonical: "/editor" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EditorPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = params.level;
  const levelId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  return <EditorClient levelId={levelId} />;
}
