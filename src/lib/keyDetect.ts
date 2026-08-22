import type { ScaleId } from "@/lib/synth";

export type KeyDetectResult = {
  rootPc: number;
  mode: "major" | "minor";
  scaleId: ScaleId;
  confidence: number; // 0..1
};

// Krumhansl-Schmuckler key profiles
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function rotate(arr: number[], n: number) {
  return arr.map((_, i) => arr[(i + n) % 12] ?? 0);
}

function correlation(a: number[], b: number[]) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = (a[i] ?? 0) - ma;
    const y = (b[i] ?? 0) - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function pickScale(chroma: number[], rootPc: number, mode: "major" | "minor"): ScaleId {
  const norm = (pc: number) => chroma[(pc + rootPc) % 12] ?? 0;
  const total = chroma.reduce((s, v) => s + v, 0) || 1;
  const score = (steps: number[]) => steps.reduce((s, st) => s + norm(st), 0) / total;
  if (mode === "minor") {
    const options: { id: ScaleId; steps: number[] }[] = [
      { id: "minorPent", steps: [0, 3, 5, 7, 10] },
      { id: "naturalMinor", steps: [0, 2, 3, 5, 7, 8, 10] },
      { id: "dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
      { id: "phrygian", steps: [0, 1, 3, 5, 7, 8, 10] },
      { id: "harmonicMinor", steps: [0, 2, 3, 5, 7, 8, 11] },
    ];
    // prefer coverage per note to avoid always winning with 7-note scales
    return options.reduce((best, o) =>
      score(o.steps) / o.steps.length > score(best.steps) / best.steps.length ? o : best,
    ).id;
  }
  const options: { id: ScaleId; steps: number[] }[] = [
    { id: "majorPent", steps: [0, 2, 4, 7, 9] },
    { id: "major", steps: [0, 2, 4, 5, 7, 9, 11] },
  ];
  return options.reduce((best, o) =>
    score(o.steps) / o.steps.length > score(best.steps) / best.steps.length ? o : best,
  ).id;
}

export function analyzeChroma(chroma: number[]): KeyDetectResult {
  const scores: { rootPc: number; mode: "major" | "minor"; v: number }[] = [];
  for (let pc = 0; pc < 12; pc++) {
    scores.push({ rootPc: pc, mode: "major", v: correlation(chroma, rotate(MAJOR, (12 - pc) % 12)) });
    scores.push({ rootPc: pc, mode: "minor", v: correlation(chroma, rotate(MINOR, (12 - pc) % 12)) });
  }
  scores.sort((a, b) => b.v - a.v);
  const top = scores[0]!;
  const second = scores[1]!;
  const confidence = Math.max(0, Math.min(1, (top.v - second.v) * 4 + top.v * 0.35));
  return {
    rootPc: top.rootPc,
    mode: top.mode,
    scaleId: pickScale(chroma, top.rootPc, top.mode),
    confidence,
  };
}

export type DetectOptions = {
  durationMs: number;
  signal?: AbortSignal;
  onProgress?: (p: { progress: number; level: number }) => void;
};

/** Listens through the microphone and estimates key + scale. */
export async function detectKey(opts: DetectOptions): Promise<KeyDetectResult> {
  const { durationMs, signal, onProgress } = opts;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microfono non disponibile su questo dispositivo.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0.2;
  source.connect(analyser);

  const bins = analyser.frequencyBinCount;
  const data = new Float32Array(bins);
  const binHz = ctx.sampleRate / analyser.fftSize;
  const chroma = new Array(12).fill(0);
  let frames = 0;

  const cleanup = () => {
    try {
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    } catch {
      /* noop */
    }
  };

  try {
    const start = performance.now();
    await new Promise<void>((resolve, reject) => {
      const tick = () => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        analyser.getFloatFrequencyData(data);
        let level = 0;
        let frameEnergy = 0;
        const frame = new Array(12).fill(0);
        for (let i = 1; i < bins; i++) {
          const f = i * binHz;
          if (f < 80 || f > 4000) continue;
          const db = data[i] ?? -200;
          if (db < -85) continue;
          const mag = Math.pow(10, db / 20);
          const pc = ((Math.round(12 * Math.log2(f / 440)) + 9) % 12 + 12) % 12;
          frame[pc] = (frame[pc] ?? 0) + mag;
          frameEnergy += mag;
          if (mag > level) level = mag;
        }
        if (frameEnergy > 1e-4) {
          for (let i = 0; i < 12; i++) chroma[i] = (chroma[i] ?? 0) + (frame[i] ?? 0) / frameEnergy;
          frames++;
        }
        const progress = Math.min(1, (performance.now() - start) / durationMs);
        onProgress?.({ progress, level: Math.min(1, level * 25) });
        if (progress >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  } finally {
    cleanup();
  }

  if (frames < 5) throw new Error("Segnale troppo debole: avvicina il microfono e riprova.");
  return analyzeChroma(chroma.map((v) => v / frames));
}
