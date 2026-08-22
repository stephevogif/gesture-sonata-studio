import { useCallback, useEffect, useRef, useState } from "react";
import {
  GestureSynthEngine,
  INSTRUMENTS,
  midiToFreq,
  midiToName,
  positionToMidi,
  type InstrumentId,
} from "@/lib/synth";

type HandState = { note: string; level: number; hand: string };

export default function GestureSynth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GestureSynthEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);

  const [instrument, setInstrument] = useState<InstrumentId>("violin");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [hands, setHands] = useState<HandState[]>([]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    engineRef.current?.allOff();
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setRunning(false);
    setHands([]);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarkerRef.current;
    const engine = engineRef.current;
    if (!video || !canvas || !lm || !engine) return;

    const ctx = canvas.getContext("2d");
    if (ctx && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const res = lm.detectForVideo(video, performance.now());
      const active = new Set<string>();
      const next: HandState[] = [];

      (res?.landmarks ?? []).forEach((pts: { x: number; y: number }[], i: number) => {
        const id = `h${i}`;
        active.add(id);
        const wrist = pts[0]!;
        const indexTip = pts[8]!;
        const thumbTip = pts[4]!;
        const middleTip = pts[12]!;

        // horizontal position (mirrored) -> pitch
        const x = 1 - indexTip.x;
        const midi = positionToMidi(x);
        // vertical -> brightness, hand openness -> loudness
        const bright = 1 - Math.min(1, Math.max(0, indexTip.y));
        const span = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);
        const level = Math.min(1, Math.max(0, (span - 0.05) / 0.22));

        if (level > 0.06) {
          engine.noteOn(id, midiToFreq(midi), level, bright);
          next.push({
            note: midiToName(midi),
            level,
            hand: res.handedness?.[i]?.[0]?.categoryName === "Left" ? "Destra" : "Sinistra",
          });
        } else {
          engine.noteOff(id);
        }

        // draw
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 2;
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${35 + level * 180}, 90%, 60%, 0.85)`;
          ctx.fill();
        });
        ctx.beginPath();
        ctx.moveTo(wrist.x * canvas.width, wrist.y * canvas.height);
        ctx.lineTo(indexTip.x * canvas.width, indexTip.y * canvas.height);
        ctx.stroke();
        ctx.restore();
      });

      ["h0", "h1"].forEach((id) => {
        if (!active.has(id)) engine.noteOff(id);
      });
      setHands(next);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    try {
      setStatus("Avvio audio e fotocamera…");
      const engine = engineRef.current ?? new GestureSynthEngine();
      engineRef.current = engine;
      engine.setInstrument(instrument);
      await engine.start();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      if (!landmarkerRef.current) {
        setStatus("Carico il rilevamento delle mani…");
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
      setStatus("Impossibile accedere alla fotocamera o all'audio.");
      setRunning(false);
    }
  }, [instrument, loop]);

  const pickInstrument = (id: InstrumentId) => {
    setInstrument(id);
    engineRef.current?.setInstrument(id);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Strumento gestuale
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-foreground sm:text-6xl">
          Gesture <span className="text-primary">Synth</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Suona violino, fiati e pads muovendo le mani davanti alla fotocamera. Nessun contatto,
          solo aria.
        </p>
      </header>

      <div className="mt-8 overflow-hidden rounded-3xl border border-border bg-card shadow-glow">
        <div className="relative aspect-[4/3] w-full bg-stage">
          <video ref={videoRef} playsInline muted className="hidden" />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="max-w-sm text-sm text-muted-foreground">
                {status || "Consenti l'accesso alla fotocamera per iniziare a suonare."}
              </p>
              <button onClick={start} className="btn-hero">
                Inizia a suonare
              </button>
            </div>
          )}
          {running && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4">
              <div className="flex gap-2">
                {hands.length === 0 && (
                  <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                    Apri la mano per produrre suono
                  </span>
                )}
                {hands.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-background/70 px-3 py-1 text-xs text-foreground backdrop-blur"
                  >
                    {h.hand}: <strong className="text-primary">{h.note}</strong>{" "}
                    {Math.round(h.level * 100)}%
                  </span>
                ))}
              </div>
              <button onClick={stop} className="pointer-events-auto btn-ghost">
                Stop
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {INSTRUMENTS.map((i) => (
          <button
            key={i.id}
            onClick={() => pickInstrument(i.id)}
            className={
              instrument === i.id ? "instrument-card instrument-card-active" : "instrument-card"
            }
          >
            <span className="font-display text-xl">{i.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{i.blurb}</span>
          </button>
        ))}
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ["Sinistra / destra", "Sposta la mano in orizzontale per cambiare nota sulla scala."],
          ["Alto / basso", "Alza la mano per un timbro più brillante, abbassala per scurirlo."],
          ["Apri / chiudi", "L'apertura fra pollice e medio controlla il volume, come un arco."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-border bg-card/60 p-4">
            <h2 className="font-display text-base text-foreground">{t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
