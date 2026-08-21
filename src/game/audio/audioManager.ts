export type SoundName = "jump" | "death" | "orb" | "portal";

const SOURCES: Record<SoundName, string> = {
  jump: "/audio/jump.wav",
  death: "/audio/death.wav",
  orb: "/audio/orb.wav",
  portal: "/audio/portal.wav",
};

const MUTE_KEY = "qRunner.muted";

/**
 * Web Audio rather than pooled <audio> elements: an auto-runner needs the
 * jump cue to land on the frame the jump happens, and element playback has
 * enough latency to feel disconnected.
 *
 * The context is created on the first gesture because browsers refuse to start
 * one before that, and every load failure degrades to silence.
 */
class AudioManager {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private buffers = new Map<SoundName, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private muted = false;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      this.muted = window.localStorage.getItem(MUTE_KEY) === "true";
    }
  }

  /** Store contract for `useSyncExternalStore`. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isMuted = (): boolean => this.muted;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gain && this.context) {
      this.gain.gain.setValueAtTime(muted ? 0 : 1, this.context.currentTime);
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_KEY, String(muted));
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Safe to call on every gesture; the work only happens once. */
  unlock(): void {
    if (typeof window === "undefined" || this.loading) {
      return;
    }

    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) {
      this.loading = Promise.resolve();
      return;
    }

    const context = new Constructor();
    const gain = context.createGain();
    gain.gain.value = this.muted ? 0 : 1;
    gain.connect(context.destination);

    this.context = context;
    this.gain = gain;

    this.loading = Promise.all(
      (Object.keys(SOURCES) as SoundName[]).map(async (name) => {
        try {
          const response = await fetch(SOURCES[name]);
          if (!response.ok) {
            return;
          }
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          this.buffers.set(name, buffer);
        } catch {
          // A missing cue is not worth breaking the run over.
        }
      }),
    ).then(() => undefined);
  }

  play(name: SoundName, volume = 1): void {
    const context = this.context;
    const gain = this.gain;
    const buffer = this.buffers.get(name);
    if (!context || !gain || !buffer || this.muted) {
      return;
    }
    if (context.state === "suspended") {
      void context.resume();
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const localGain = context.createGain();
    localGain.gain.value = volume;
    source.connect(localGain);
    localGain.connect(gain);
    source.start();
  }
}

export const audio = new AudioManager();
