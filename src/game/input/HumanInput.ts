import type { Action, InputProvider } from "@/game/core/types";

export class HumanInput implements InputProvider {
  private jumpQueued = false;
  private cleanup: (() => void) | null = null;

  bind(target: Window): void {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        this.jumpQueued = true;
      }
    };

    const onPointerDown = () => {
      this.jumpQueued = true;
    };

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("mousedown", onPointerDown);
    target.addEventListener("touchstart", onPointerDown, { passive: true });

    this.cleanup = () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("mousedown", onPointerDown);
      target.removeEventListener("touchstart", onPointerDown);
    };
  }

  unbind(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  getAction(): Action {
    if (this.jumpQueued) {
      this.jumpQueued = false;
      return 1;
    }
    return 0;
  }
}
