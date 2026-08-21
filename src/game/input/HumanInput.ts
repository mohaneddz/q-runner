import type { Action, InputProvider } from "@/game/core/types";

const JUMP_KEYS = new Set(["Space", "ArrowUp", "KeyW", "Enter"]);

/**
 * Hold-based rather than edge-based: ship mode needs a sustained press, and
 * the cube auto-jumping while held is the expected behaviour.
 */
export class HumanInput implements InputProvider {
  private held = false;
  private pointerHeld = false;
  private keyHeld = false;
  private cleanup: (() => void) | null = null;

  bind(target: HTMLElement): void {
    const sync = () => {
      this.held = this.pointerHeld || this.keyHeld;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!JUMP_KEYS.has(event.code) || event.repeat) {
        return;
      }
      // Space scrolls the page and Enter re-triggers the focused button.
      event.preventDefault();
      this.keyHeld = true;
      sync();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!JUMP_KEYS.has(event.code)) {
        return;
      }
      this.keyHeld = false;
      sync();
    };

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      this.pointerHeld = true;
      sync();
    };

    const onPointerUp = () => {
      this.pointerHeld = false;
      sync();
    };

    const onBlur = () => {
      this.pointerHeld = false;
      this.keyHeld = false;
      sync();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    target.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    this.cleanup = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      target.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }

  unbind(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.held = false;
    this.pointerHeld = false;
    this.keyHeld = false;
  }

  getAction(): Action {
    return this.held ? 1 : 0;
  }
}
