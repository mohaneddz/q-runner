import { PlayClient } from "@/components/game/PlayClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PlayPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const raw = params.level;
  const levelId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return <PlayClient levelId={levelId} />;
}
