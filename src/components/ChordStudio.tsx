import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Layers, Music2, Play, Square } from "lucide-react";
import {
  GestureSynthEngine,
  INSTRUMENTS,
  INSTRUMENT_SHIFT,
  NOTE_NAMES,
  SCALES,
  degreeToMidi,
  midiToName,
  scaleSteps,
  type InstrumentId,
  type ScaleId,
} from "@/lib/synth";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "I'"];

type VoiceMode = "chords" | "single";

type HandInfo = {
  side: "left" | "right";
  degree: number;
  fingers: number;
  level: number;
  tilt: number;
};

/** conta le dita alzate (senza pollice) e restituisce anche lo stato del pollice */
function readHand(lm: { x: number; y: number }[]) {
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  let count = 0;
  const up: boolean[] = [];
  for (let i = 0; i < tips.length; i++) {
    const t = lm[tips[i]!]!;
    const p = lm[pips[i]!]!;
    const isUp = t.y < p.y - 0.015;
    up.push(isUp);
    if (isUp) count++;
  }
  const wrist = lm[0]!;
  const thumbTip = lm[4]!;
  const thumbIp = lm[3]!;
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const thumbUp = d(thumbTip, wrist) > d(thumbIp, wrist) * 1.12;

  const a = lm[5]!;
  const b = lm[17]!;
  const tilt = Math.atan2(b.y - a.y, b.x - a.x);

  const y = (wrist.y + lm[9]!.y) / 2;
  const openness = Math.min(1, (count + (thumbUp ? 1 : 0)) / 5);

  return { count, up, thumbUp, tilt, y, openness };
}

/** mappa dita -> grado di scala (I..VII) */
function fingersToDegree(up: boolean[], thumbUp: boolean, count: number): number | null {
  if (count === 0 && !thumbUp) return null;
  const [idx, mid, ring, pinky] = up;
  if (idx && pinky && !mid && !ring) return thumbUp ? 6 : 5;
  if (count >= 1 && count <= 5) return count - 1;
  return thumbUp ? 0 : null;
}

type Cloud = { x: number; y: number; r: number; v: number; a: number };

export default function ChordStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GestureSynthEngine | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef<Set<string>>(new Set());
  const cloudsRef = useRef<Cloud[]>([]);
  const glowRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [hands, setHands] = useState<HandInfo[]>([]);
  const [scale, setScale] = useState<ScaleId>("major");
  const [rootPc, setRootPc] = useState(9);
  const [instrument, setInstrument] = useState<InstrumentId>("pads");
  const [minorFlip, setMinorFlip] = useState(true);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("chords");

  const cfg = useRef({ scale, rootPc, instrument, minorFlip, voiceMode });
  useEffect(() => {
    cfg.current = { scale, rootPc, instrument, minorFlip, voiceMode };
    const e = engineRef.current;
    if (!e) return;
    e.setScale(scaleSteps(scale), rootPc);
    e.setInstrument(instrument);
    if (voiceMode === "single") e.setChord("off");
  }, [scale, rootPc, instrument, minorFlip, voiceMode]);

  const degrees = scaleSteps(scale);
  const noteLabels = Array.from({ length: 8 }, (_, i) =>
    midiToName(degreeToMidi(i, degrees, rootPc)).replace(/\d+$/, ""),
  );

  const drawSky = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, glow: number) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#f6fbff");
    sky.addColorStop(0.5, "#e6f1fb");
    sky.addColorStop(1, "#dbe8f7");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    if (cloudsRef.current.length === 0) {
      cloudsRef.current = Array.from({ length: 14 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: h * (0.12 + Math.random() * 0.28),
        v: 0.08 + Math.random() * 0.25,
        a: 0.1 + Math.random() * 0.22,
      }));
    }
    for (const c of cloudsRef.current) {
      c.x += c.v;
      if (c.x - c.r > w) c.x = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(255,255,255,${c.a + glow * 0.2})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const halo = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, h * 0.7);
    halo.addColorStop(0, `rgba(180,215,255,${0.1 + glow * 0.28})`);
    halo.addColorStop(1, "rgba(180,215,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !engine || !landmarker) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    let result: any = null;
    try {
      result = landmarker.detectForVideo(video, performance.now());
    } catch {
      /* frame non pronto */
    }

    const seen = new Set<string>();
    const info: HandInfo[] = [];
    const lmList: any[] = result?.landmarks ?? [];
    const handed: any[] = result?.handedness ?? result?.handednesses ?? [];

    const parsed = lmList.map((lm: any[], i: number) => {
      const label = handed[i]?.[0]?.categoryName === "Left" ? "right" : "left";
      return { label: label as "left" | "right", lm, read: readHand(lm) };
    });
    const rightHand = parsed.find((p) => p.label === "right") ?? null;
    const expr = rightHand
      ? {
          level: Math.max(0, Math.min(1, (1 - rightHand.read.y) / 0.7)),
          bright: Math.max(0, Math.min(1, 0.5 + rightHand.read.tilt)),
          fingers: rightHand.read.count,
        }
      : { level: 0.75, bright: 0.5, fingers: 3 };

    engine.setChord(
      cfg.current.voiceMode === "single"
        ? "off"
        : expr.fingers >= 4
          ? "seventh"
          : expr.fingers >= 2
            ? "triad"
            : expr.fingers === 1
              ? "fifth"
              : "off",
    );

    // sfondo: solo cielo e nuvole, nessuna immagine dalla fotocamera
    const target = parsed.length > 0 ? expr.level : 0;
    glowRef.current += (target - glowRef.current) * 0.06;
    drawSky(ctx, w, h, glowRef.current);

    for (const p of parsed) {
      const { lm, read, label } = p;
      const px = (n: number) => (1 - lm[n]!.x) * w;
      const py = (n: number) => lm[n]!.y * h;
      const links = [
        [0, 5], [5, 9], [9, 13], [13, 17], [17, 0],
        [0, 1], [1, 2], [2, 3], [3, 4],
        [5, 6], [6, 7], [7, 8],
        [9, 10], [10, 11], [11, 12],
        [13, 14], [14, 15], [15, 16],
        [17, 18], [18, 19], [19, 20],
      ];

      // alone morbido
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 28;
      ctx.shadowColor = label === "left" ? "rgba(120,180,255,0.9)" : "rgba(160,210,240,0.9)";
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineCap = "round";
      ctx.lineWidth = 10;
      ctx.beginPath();
      for (const [a, b] of links) {
        ctx.moveTo(px(a!), py(a!));
        ctx.lineTo(px(b!), py(b!));
      }
      ctx.stroke();

      ctx.shadowBlur = 12;
      ctx.strokeStyle = label === "left" ? "rgba(90,150,230,0.95)" : "rgba(120,190,225,0.95)";
      ctx.lineWidth = 3;
      ctx.stroke();

      for (let i = 0; i < 21; i++) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.shadowBlur = 16;
        ctx.arc(px(i), py(i), i % 4 === 0 ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (label !== "left") continue;

      const degree = fingersToDegree(read.up, read.thumbUp, read.count);
      if (degree === null) continue;
      const minor = cfg.current.minorFlip && read.tilt > 0.35;
      const id = "L";
      const inst = cfg.current.instrument;
      const baseMidi =
        degreeToMidi(degree, scaleSteps(cfg.current.scale), cfg.current.rootPc, INSTRUMENT_SHIFT[inst] ?? 0) +
        (minor ? -1 : 0);
      engine.noteOnChord(id, baseMidi, degree, Math.max(0.15, expr.level), expr.bright, inst);
      engine.setFilterMod(expr.bright);
      seen.add(id);
      info.push({ side: "left", degree, fingers: read.count, level: expr.level, tilt: read.tilt });
    }

    if (rightHand) {
      info.push({
        side: "right",
        degree: -1,
        fingers: expr.fingers,
        level: expr.level,
        tilt: rightHand.read.tilt,
      });
    }

    for (const id of [...activeRef.current]) {
      if (!seen.has(id)) {
        engine.noteOff(id, true);
        activeRef.current.delete(id);
      }
    }
    seen.forEach((id) => activeRef.current.add(id));
    setHands(info);

    rafRef.current = requestAnimationFrame(loop);
  }, [drawSky]);

  const start = useCallback(async () => {
    try {
      setStatus("Avvio…");
      const engine = engineRef.current ?? new GestureSynthEngine();
      engineRef.current = engine;
      await engine.start();
      engine.setScale(scaleSteps(cfg.current.scale), cfg.current.rootPc);
      engine.setInstrument(cfg.current.instrument);
      engine.setReverb(0.5);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      if (!landmarkerRef.current) {
        setStatus("Preparazione…");
        const vision = await import("@mediapipe/tasks-vision");
        const files = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
        );
        landmarkerRef.current = await vision.HandLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
      }

      setStatus("");
      setRunning(true);
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
      setStatus("Impossibile accedere alla fotocamera.");
      setRunning(false);
    }
  }, [loop]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    engineRef.current?.allOff();
    activeRef.current.clear();
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setRunning(false);
    setHands([]);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const active = hands.find((h) => h.side === "left");

  return (
    <div className="sky-theme min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        <header className="flex items-center justify-between gap-2">
          <Link
            to="/"
            className="sky-chip flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Sky Synth
          </Link>
          <h1 className="font-display text-base tracking-[0.14em] text-foreground sm:text-xl">
            Chord <span className="text-primary">Studio</span>
          </h1>
          <button
            onClick={running ? stop : start}
            className="sky-chip sky-chip-active flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.2em]"
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Stop" : "Play"}
          </button>
        </header>

        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setVoiceMode("chords")}
            className={`sky-chip flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
              voiceMode === "chords" ? "sky-chip-active" : "text-muted-foreground"
            }`}
          >
            <Layers className="h-4 w-4" />
            Accordi
          </button>
          <button
            onClick={() => setVoiceMode("single")}
            className={`sky-chip flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${
              voiceMode === "single" ? "sky-chip-active" : "text-muted-foreground"
            }`}
          >
            <Music2 className="h-4 w-4" />
            Note singole
          </button>
        </div>

        <div className="sky-frame mt-4">
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-stage sm:aspect-[4/3]">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

            {running && (
              <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
                <p className="text-center text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  {NOTE_NAMES[rootPc]} {SCALES.find((s) => s.id === scale)?.name} ·{" "}
                  {voiceMode === "chords" ? "accordi" : "note singole"}
                </p>
                <div className="mt-2 flex justify-center gap-1">
                  {noteLabels.map((n, i) => (
                    <div
                      key={i}
                      className={`sky-chip flex min-w-9 flex-col items-center px-1.5 py-1 ${
                        active?.degree === i ? "sky-chip-active" : "text-foreground/80"
                      }`}
                    >
                      <span className="text-sm font-semibold leading-none">{n}</span>
                      <span className="mt-1 text-[9px] tracking-widest text-muted-foreground">
                        {ROMAN[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  {status ||
                    "Lato A sceglie il grado della scala e l'inclinazione passa da maggiore a minore. Lato B: altezza = volume, dita = ricchezza armonica, inclinazione = timbro."}
                </p>
                <button onClick={start} className="btn-hero rounded-full">
                  Inizia a suonare
                </button>
              </div>
            )}

            {running && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-3">
                {hands.length === 0 ? (
                  <span className="sky-chip px-3 py-1 text-[11px] text-muted-foreground">Pronto</span>
                ) : (
                  hands.map((h, i) => (
                    <span key={i} className="sky-chip px-3 py-1 text-[11px] text-foreground">
                      {h.side === "left" ? "Lato A" : "Lato B"} ·{" "}
                      {h.side === "left" ? (
                        <strong className="text-primary">
                          {midiToName(degreeToMidi(h.degree, degrees, rootPc))}
                        </strong>
                      ) : (
                        <>
                          {h.fingers} · {Math.round(h.level * 100)}%
                        </>
                      )}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="sky-panel mt-4 space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Tonica</span>
            {NOTE_NAMES.map((n, i) => (
              <button
                key={n}
                onClick={() => setRootPc(i)}
                className={`sky-chip px-2.5 py-1 text-[11px] ${
                  rootPc === i ? "sky-chip-active" : "text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Scala</span>
            {SCALES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScale(s.id)}
                className={`sky-chip px-2.5 py-1 text-[11px] ${
                  scale === s.id ? "sky-chip-active" : "text-muted-foreground"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Strumento</span>
            {INSTRUMENTS.map((it) => (
              <button
                key={it.id}
                onClick={() => setInstrument(it.id)}
                className={`sky-chip px-2.5 py-1 text-[11px] ${
                  instrument === it.id ? "sky-chip-active" : "text-muted-foreground"
                }`}
              >
                {it.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMinorFlip((v) => !v)}
            className={`sky-chip px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] ${
              minorFlip ? "sky-chip-active" : "text-muted-foreground"
            }`}
          >
            Inclinazione maggiore/minore
          </button>
        </div>
      </div>
    </div>
  );
}
