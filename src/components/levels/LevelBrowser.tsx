"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { BUILTIN_LEVELS, type LevelSummary } from "@/game/level/builtinLevels";
import type { LevelData } from "@/game/level/levelSchema";
import { deleteSavedLevel, listSavedLevels } from "@/game/level/levelStore";
import { loadAllProgress, type LevelProgress } from "@/game/level/progressStore";

function LevelCard({
  summary,
  progress,
}: {
  summary: LevelSummary;
  progress: LevelProgress | undefined;
}) {
  return (
    <article className={`panel pad levelCard ${progress?.completed ? "levelCardDone" : ""}`}>
      <header className="levelCardHead">
        <span className="levelTier">{String(summary.tier).padStart(2, "0")}</span>
        <div>
          <h3>{summary.name}</h3>
          <p className="muted small">
            {summary.modes.join(" · ")}
            {summary.hasGravityFlips ? " · flips" : ""}
          </p>
        </div>
        {progress?.completed ? <span className="badge badgeDone">Cleared</span> : null}
      </header>

      <ProgressBar
        value={progress?.bestProgress ?? 0}
        label={`Best progress on ${summary.name}`}
      />

      <footer className="levelCardFoot">
        <span className="muted small">
          {summary.length.toFixed(0)}u · speed {summary.baseSpeed}
          {progress?.attempts ? ` · ${progress.attempts} attempts` : ""}
        </span>
        <Link href={`/play?level=${summary.id}`} className="btn btnPrimary">
          Play
        </Link>
      </footer>
    </article>
  );
}

export function LevelBrowser() {
  const [progress, setProgress] = useState<Record<string, LevelProgress>>({});
  const [saved, setSaved] = useState<LevelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [progressMap, savedLevels] = await Promise.all([
        loadAllProgress(),
        listSavedLevels(),
      ]);
      if (cancelled) {
        return;
      }
      setProgress(progressMap);
      setSaved(savedLevels);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const cleared = BUILTIN_LEVELS.filter((level) => progress[level.id]?.completed).length;

  return (
    <div className="stack">
      <section className="stack">
        <div className="sectionHead">
          <h2>Campaign</h2>
          <span className="muted">
            {loading ? "…" : `${cleared} of ${BUILTIN_LEVELS.length} cleared`}
          </span>
        </div>
        <div className="levelGrid">
          {BUILTIN_LEVELS.map((summary) => (
            <LevelCard key={summary.id} summary={summary} progress={progress[summary.id]} />
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="sectionHead">
          <h2>Your levels</h2>
          <Link href="/editor" className="btn">
            New level
          </Link>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : saved.length === 0 ? (
          <p className="muted">
            Nothing saved yet. Anything you build in the editor shows up here.
          </p>
        ) : (
          <div className="levelGrid">
            {saved.map((level) => (
              <article key={level.meta.id} className="panel pad levelCard">
                <header className="levelCardHead">
                  <div>
                    <h3>{level.meta.name}</h3>
                    <p className="muted small">
                      {level.objects.length} objects · {level.settings.length.toFixed(0)}u
                    </p>
                  </div>
                </header>
                <ProgressBar
                  value={progress[level.meta.id]?.bestProgress ?? 0}
                  label={`Best progress on ${level.meta.name}`}
                />
                <footer className="levelCardFoot">
                  <button
                    type="button"
                    className="btn btnDanger"
                    onClick={async () => {
                      await deleteSavedLevel(level.meta.id);
                      setReloadToken((token) => token + 1);
                    }}
                  >
                    Delete
                  </button>
                  <div className="toolRowActions">
                    <Link href={`/editor?level=${level.meta.id}`} className="btn">
                      Edit
                    </Link>
                    <Link href={`/play?level=${level.meta.id}`} className="btn btnPrimary">
                      Play
                    </Link>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
