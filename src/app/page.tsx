import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/ui/SiteNav";
import { BUILTIN_LEVELS, FIRST_LEVEL_ID } from "@/game/level/builtinLevels";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    title: "Deterministic by construction",
    body: "A fixed 120Hz simulation drives everything. The same inputs always produce the same run, which is what makes replays and the solver meaningful.",
  },
  {
    title: "Levels proven clearable",
    body: "Every built-in level is grown against a reachability solver that may only change its input every 50ms. If a level ships, a person can finish it.",
  },
  {
    title: "Endless mode that cannot cheat you",
    body: "Chunks are generated ahead of the player and rejected unless the solver can still cross them, so you never hit an impossible wall.",
  },
  {
    title: "A learner you can watch",
    body: "A tabular Q-learning agent trains in your browser against the same engine you play, with its table saved between sessions.",
  },
];

export default function HomePage() {
  return (
    <main className="appShell stack">
      <SiteNav />

      <section className="panel hero">
        <div className="heroCopy">
          <h1>
            A precision auto-runner
            <br />
            with a solver in the build.
          </h1>
          <p className="muted">
            Q-Runner is a browser platformer with cube, ship and ball modes, gravity portals,
            a full level editor and a Q-learning playground. No backend, no physics engine —
            the simulation is hand-rolled and shared by the game, the editor and the
            build-time validator.
          </p>
          <div className="heroActions">
            <Link href={`/play?level=${FIRST_LEVEL_ID}`} className="btn btnPrimary btnLarge">
              Play
            </Link>
            <Link href="/endless" className="btn btnLarge">
              Endless run
            </Link>
            <Link href="/editor" className="btn btnLarge">
              Build a level
            </Link>
          </div>
        </div>
        <dl className="heroStats">
          <div>
            <dt>Built-in levels</dt>
            <dd>{BUILTIN_LEVELS.length}</dd>
          </div>
          <div>
            <dt>Tick rate</dt>
            <dd>120Hz</dd>
          </div>
          <div>
            <dt>Modes</dt>
            <dd>3</dd>
          </div>
        </dl>
      </section>

      <section className="featureGrid">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="panel pad">
            <h2 className="featureTitle">{feature.title}</h2>
            <p className="muted">{feature.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
