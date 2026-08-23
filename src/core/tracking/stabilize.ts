/**
 * Heaven Synth — gesture stabilizer.
 * Layer: Gesture Stabilizer (pure, testable, no DOM).
 *
 * Tracking output flickers ("5,5,5,4,5,5"). A musical instrument must ignore
 * that flicker without feeling sluggish, so discrete values are only promoted
 * once they have been observed continuously for a short hold window, while
 * continuous values are glided with a one-pole filter.
 */

/** Confirms a discrete value only after it stays stable for `holdMs`. */
export class GestureLatch<T> {
  private candidate: T | null = null;
  private candidateSince = 0;
  private stable: T | null = null;

  constructor(
    private readonly holdMs = 120,
    /** a value can be dropped faster than it is adopted (0 = same window) */
    private readonly releaseMs = 0,
  ) {}

  push(value: T, now = performance.now()): T | null {
    if (value !== this.candidate) {
      this.candidate = value;
      this.candidateSince = now;
    }
    if (this.stable !== value) {
      const isRelease = value === null || value === undefined;
      const window = isRelease && this.releaseMs > 0 ? this.releaseMs : this.holdMs;
      if (now - this.candidateSince >= window) this.stable = value;
    }
    return this.stable;
  }

  get value(): T | null {
    return this.stable;
  }

  reset() {
    this.candidate = null;
    this.stable = null;
    this.candidateSince = 0;
  }
}

/** One-pole glide for continuous controls (volume, cutoff, position). */
export class ValueGlide {
  private current: number | null = null;

  constructor(private readonly rate = 0.18) {}

  push(target: number): number {
    this.current =
      this.current === null ? target : this.current + (target - this.current) * this.rate;
    return this.current;
  }

  get value(): number {
    return this.current ?? 0;
  }

  reset() {
    this.current = null;
  }
}

/** Two-state switch with a dead zone, so a control never chatters at the edge. */
export class HysteresisSwitch<T extends string> {
  private state: T;

  constructor(
    initial: T,
    private readonly high: T,
    private readonly low: T,
    private readonly upper = 0.28,
    private readonly lower = -0.17,
  ) {
    this.state = initial;
  }

  push(value: number): T {
    if (value > this.upper) this.state = this.high;
    else if (value < this.lower) this.state = this.low;
    return this.state;
  }

  get value(): T {
    return this.state;
  }
}
