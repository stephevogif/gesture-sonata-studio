import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Square } from "lucide-react";
import {
  GestureSynthEngine,
  INSTRUMENTS,
  INSTRUMENT_SHIFT,
  NOTE_NAMES,
  SCALES,
  degreeToMidi,
  midiToFreq,
  midiToName,
  scaleSteps,
  type InstrumentId,
  type ScaleId,
} from "@/lib/synth";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "I'"];

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

  // roll del polso: vettore indice-MCP -> mignolo-MCP
  const a = lm[5]!;
  const b = lm[17]!;
  const tilt = Math.atan2(b.y - a.y, b.x - a.x); // rad

  // altezza media della mano (0 in alto, 1 in basso)
  const y = (wrist.y + lm[9]!.y) / 2;
  const openness = Math.min(1, (count + (thumbUp ? 1 : 0)) / 5);

  return { count, up, thumbUp, tilt, y, openness };
}

/** mappa dita -> grado di scala (I..VII), stile gesture synth */
function fingersToDegree(up: boolean[], thumbUp: boolean, count: number): number | null {
  if (count === 0 && !thumbUp) return null;
  const [idx, mid, ring, pinky] = up;
  if (idx && pinky && !mid && !ring) return thumbUp ? 6 : 5; // VII / VI
  if (count >= 1 && count <= 5) return count - 1; // I..V
  return thumbUp ? 0 : null;
}

export default function ChordStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GestureSynthEngine | null>(null);
  const landmarkerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef<Set<string>>(new Set());

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [hands, setHands] = useState<HandInfo[]>([]);
  const [scale, setScale] = useState<ScaleId>("major");
  const [rootPc, setRootPc] = useState(9); // A
  const [instrument, setInstrument] = useState<InstrumentId>("pads");
  const [minorFlip, setMinorFlip] = useState(true);

  const cfg = useRef({ scale, rootPc, instrument, minorFlip });
  useEffect(() => {
    cfg.current = { scale, rootPc, instrument, minorFlip };
    const e = engineRef.current;
    if (!e) return;
    e.setScale(scaleSteps(scale), rootPc);
    e.setInstrument(instrument);
  }, [scale, rootPc, instrument, minorFlip]);

  const degrees = scaleSteps(scale);
  const noteLabels = Array.from({ length: 8 }, (_, i) =>
    midiToName(degreeToMidi(i, degrees, rootPc)).replace(/\d+$/, ""),
  );

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

    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = "rgba(10, 16, 34, 0.45)";
    ctx.fillRect(0, 0, w, h);

    const seen = new Set<string>();
    const info: HandInfo[] = [];
    const lmList: any[] = result?.landmarks ?? [];
    const handed: any[] = result?.handedness ?? result?.handednesses ?? [];

    // la destra dell'utente compare a sinistra nell'immagine speculare
    let rightHand: { lm: any[]; read: ReturnType<typeof readHand> } | null = null;
    const parsed = lmList.map((lm: any[], i: number) => {
      const label = handed[i]?.[0]?.categoryName === "Left" ? "right" : "left";
      return { label: label as "left" | "right", lm, read: readHand(lm) };
    });
    rightHand = parsed.find((p) => p.label === "right") ?? null;
    const expr = rightHand
      ? {
          level: Math.max(0, Math.min(1, (1 - rightHand.read.y) / 0.7)),
          bright: Math.max(0, Math.min(1, 0.5 + rightHand.read.tilt)),
          fingers: rightHand.read.count,
        }
      : { level: 0.75, bright: 0.5, fingers: 3 };

    engine.setChord(
      expr.fingers >= 4 ? "seventh" : expr.fingers >= 2 ? "triad" : expr.fingers === 1 ? "fifth" : "off",
    );

    for (const p of parsed) {
      const { lm, read, label } = p;
      // scheletro
      ctx.strokeStyle = label === "left" ? "rgba(240, 200, 120, 0.85)" : "rgba(150, 210, 255, 0.8)";
      ctx.lineWidth = 3;
      const px = (n: number) => (1 - lm[n]!.x) * w;
      const py = (n: number) => lm[n]!.y * h;
      const links = [
        [0, 5],
        [5, 9],
        [9, 13],
        [13, 17],
        [17, 0],
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [5, 6],
        [6, 7],
        [7, 8],
        [9, 10],
        [10, 11],
        [11, 12],
        [13, 14],
        [14, 15],
        [15, 16],
        [17, 18],
        [18, 19],
        [19, 20],
      ];
      ctx.beginPath();
      for (const [a, b] of links) {
        ctx.moveTo(px(a!), py(a!));
        ctx.lineTo(px(b!), py(b!));
      }
      ctx.stroke();

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
  }, []);

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
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <header className="flex items-center justify-between gap-2">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-sm border border-border bg-card/60 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sky Synth
        </Link>
        <h1 className="font-display text-base tracking-[0.16em] text-foreground sm:text-xl">
          Chord <span className="text-primary">Studio</span>
        </h1>
        <button
          onClick={running ? stop : start}
          className="flex items-center gap-2 rounded-sm border border-primary bg-primary/15 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-primary"
        >
          {running ? <Square className="h-4 w-4" /> : null}
          {running ? "Stop" : "Play"}
        </button>
      </header>

      <div className="celestial-frame mt-4 rounded-sm shadow-glow">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-stage sm:aspect-[4/3]">
          <video ref={videoRef} playsInline muted className="hidden" />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

          {running && (
            <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
              <p className="text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Lato A · {NOTE_NAMES[rootPc]} {SCALES.find((s) => s.id === scale)?.name} — le dita
                scelgono il grado
              </p>
              <div className="mt-2 flex justify-center gap-1">
                {noteLabels.map((n, i) => (
                  <div
                    key={i}
                    className={`flex min-w-9 flex-col items-center rounded-sm border px-1.5 py-1 backdrop-blur ${
                      active?.degree === i
                        ? "border-primary bg-primary/25 text-primary"
                        : "border-border bg-background/40 text-foreground/80"
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
                  "Lato A: le dita scelgono il grado della scala, l'inclinazione passa da maggiore a minore. Lato B: altezza = volume, dita = tipo di accordo, inclinazione = timbro."}
              </p>
              <button onClick={start} className="btn-hero">
                Inizia a suonare
              </button>
            </div>
          )}

          {running && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-3">
              {hands.length === 0 ? (
                <span className="rounded-sm border border-border bg-background/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
                  Pronto
                </span>
              ) : (
                hands.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-sm border border-border bg-background/70 px-3 py-1 text-[11px] text-foreground backdrop-blur"
                  >
                    {h.side === "left" ? "Lato A" : "Lato B"} ·{" "}
                    {h.side === "left" ? (
                      <strong className="text-primary">
                        {midiToName(
                          degreeToMidi(h.degree, degrees, rootPc),
                        )}
                      </strong>
                    ) : (
                      <>
                        {h.fingers} dita · {Math.round(h.level * 100)}%
                      </>
                    )}
                  </span>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="celestial-panel mt-4 space-y-3 rounded-sm p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Tonica
          </span>
          {NOTE_NAMES.map((n, i) => (
            <button
              key={n}
              onClick={() => setRootPc(i)}
              className={`rounded-sm border px-2 py-1 text-[11px] ${
                rootPc === i
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Scala
          </span>
          {SCALES.map((s) => (
            <button
              key={s.id}
              onClick={() => setScale(s.id)}
              className={`rounded-sm border px-2 py-1 text-[11px] ${
                scale === s.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Strumento
          </span>
          {INSTRUMENTS.map((it) => (
            <button
              key={it.id}
              onClick={() => setInstrument(it.id)}
              className={`rounded-sm border px-2 py-1 text-[11px] ${
                instrument === it.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {it.name}
            </button>
          ))}
        </div>
        <button
          onClick={() => setMinorFlip((v) => !v)}
          className={`rounded-sm border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] ${
            minorFlip
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground"
          }`}
        >
          Inclinazione maggiore/minore
        </button>
      </div>
    </div>
  );
}

function midiFreqUnused() {
  return midiToFreq(69);
}
void midiFreqUnused;
