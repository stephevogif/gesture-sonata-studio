import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARP_PATTERNS,
  GestureSynthEngine,
  INSTRUMENTS,
  INSTRUMENT_SHIFT,
  NOTE_NAMES,
  SCALES,
  degreeToMidi,
  midiToFreq,
  midiToName,
  positionToDegree,
  scaleSteps,
  type ArpPatternId,
  type InstrumentId,
  type ScaleId,
} from "@/lib/synth";

type HandState = { note: string; level: number; hand: string; inst: string };
type PlayMode = "single" | "split" | "pinch";

const PINCH_TIPS = [8, 12, 16, 20];
const PINCH_OFFSETS = [0, 2, 4, 6];


const STEPS = 21;

export default function GestureSynth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GestureSynthEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);

  const [mode, setMode] = useState<PlayMode>("single");
  const [instrument, setInstrument] = useState<InstrumentId>("reese");
  const [leftInstrument, setLeftInstrument] = useState<InstrumentId>("pads");
  const [rightInstrument, setRightInstrument] = useState<InstrumentId>("reese");
  const [scale, setScale] = useState<ScaleId>("minorPent");
  const [rootPc, setRootPc] = useState(2);
  const [arpLeft, setArpLeft] = useState(false);
  const [arpRight, setArpRight] = useState(false);
  const [arpRate, setArpRate] = useState(8);
  const [arpPattern, setArpPattern] = useState<ArpPatternId>("up");


  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [hands, setHands] = useState<HandState[]>([]);

  // keep latest settings readable inside the rAF loop
  const cfg = useRef({
    mode,
    instrument,
    leftInstrument,
    rightInstrument,
    arpLeft,
    arpRight,
  });
  cfg.current = { mode, instrument, leftInstrument, rightInstrument, arpLeft, arpRight };

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

  useEffect(() => {
    engineRef.current?.setScale(scaleSteps(scale), rootPc);
  }, [scale, rootPc]);

  useEffect(() => {
    const degrees = ARP_PATTERNS.find((p) => p.id === arpPattern)?.degrees ?? [0];
    engineRef.current?.setArp({
      enabled: arpLeft || arpRight,
      rate: arpRate,
      degrees,
      random: arpPattern === "random",
    });
  }, [arpLeft, arpRight, arpRate, arpPattern]);


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
      const {
        mode: m,
        instrument: single,
        leftInstrument: li,
        rightInstrument: ri,
        arpLeft: aL,
        arpRight: aR,
      } = cfg.current;

      (res?.landmarks ?? []).forEach((pts: { x: number; y: number }[], i: number) => {
        const id = `h${i}`;
        const wrist = pts[0]!;
        const indexTip = pts[8]!;
        const thumbTip = pts[4]!;
        const middleTip = pts[12]!;

        // mirrored view: MediaPipe "Left" is the user's right hand
        const isRight = res.handedness?.[i]?.[0]?.categoryName === "Left";
        const inst: InstrumentId = m === "split" ? (isRight ? ri : li) : single;
        const arp = isRight ? aR : aL;

        const x = 1 - indexTip.x;
        const bright = 1 - Math.min(1, Math.max(0, indexTip.y));

        if (m === "pinch") {
          // gesturesynth.com style: pizzica pollice + dito per suonare un grado dell'accordo
          const base = positionToDegree(x, 8);
          PINCH_TIPS.forEach((tipIdx, k) => {
            const tip = pts[tipIdx]!;
            const vid = `${id}f${k}`;
            const d = Math.hypot(tip.x - thumbTip.x, tip.y - thumbTip.y);
            const on = d < 0.07;
            if (on) {
              active.add(vid);
              const level = Math.min(1, Math.max(0.35, 1 - d / 0.07));
              const degree = base + (PINCH_OFFSETS[k] ?? 0);
              const midi = degreeToMidi(
                degree,
                engine.scale,
                engine.rootPc,
                INSTRUMENT_SHIFT[inst] ?? 0,
              );
              if (arp) engine.setArpTarget(vid, degree, level, bright, inst);
              else engine.noteOn(vid, midiToFreq(midi), level, bright, inst);
              next.push({
                note: midiToName(midi),
                level,
                hand: isRight ? "Destra" : "Sinistra",
                inst: INSTRUMENTS.find((x2) => x2.id === inst)?.name ?? "",
              });
              ctx.save();
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
              ctx.beginPath();
              ctx.arc(tip.x * canvas.width, tip.y * canvas.height, 16, 0, Math.PI * 2);
              ctx.fillStyle = `hsla(${(isRight ? 20 : 190) + k * 30}, 90%, 60%, 0.35)`;
              ctx.fill();
              ctx.restore();
            }
          });
        } else {
          active.add(id);
          const degree = positionToDegree(x, STEPS);
          const midi = degreeToMidi(
            degree,
            engine.scale,
            engine.rootPc,
            INSTRUMENT_SHIFT[inst] ?? 0,
          );
          const span = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y);
          const level = Math.min(1, Math.max(0, (span - 0.05) / 0.22));

          if (level > 0.06) {
            if (arp) engine.setArpTarget(id, degree, level, bright, inst);
            else engine.noteOn(id, midiToFreq(midi), level, bright, inst);
            next.push({
              note: midiToName(midi),
              level,
              hand: isRight ? "Destra" : "Sinistra",
              inst: INSTRUMENTS.find((x2) => x2.id === inst)?.name ?? "",
            });
          } else {
            active.delete(id);
          }
        }

        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 2;
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${isRight ? 20 : 190}, 90%, 60%, 0.85)`;
          ctx.fill();
        });
        ctx.beginPath();
        ctx.moveTo(wrist.x * canvas.width, wrist.y * canvas.height);
        ctx.lineTo(indexTip.x * canvas.width, indexTip.y * canvas.height);
        ctx.stroke();
        ctx.restore();
      });

      voiceIdsRef.current.forEach((id) => {
        if (!active.has(id)) {
          engine.clearArpTarget(id);
          engine.noteOff(id);
        }
      });
      voiceIdsRef.current = active;
      setHands(next);

    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    try {
      setStatus("Avvio audio e fotocamera…");
      const engine = engineRef.current ?? new GestureSynthEngine();
      engineRef.current = engine;
      engine.instrument = instrument;
      engine.setScale(scaleSteps(scale), rootPc);
      await engine.start();
      engine.setArp({
        enabled: arpLeft || arpRight,
        rate: arpRate,
        degrees: ARP_PATTERNS.find((p) => p.id === arpPattern)?.degrees ?? [0],
        random: arpPattern === "random",
      });

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
  }, [instrument, scale, rootPc, arpOn, arpRate, arpPattern, loop]);

  const pickInstrument = (id: InstrumentId) => {
    setInstrument(id);
    engineRef.current?.setInstrument(id);
  };

  const selectClass =
    "w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground";

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
          Bassi aggressivi, arpeggiatore e modalità split: pad con la sinistra, bass con la destra.
          Scegli scala e tonica per restare sempre in chiave.
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
              <div className="flex flex-wrap gap-2">
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
                    {h.hand} · {h.inst}: <strong className="text-primary">{h.note}</strong>{" "}
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

      {/* Modalità */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => setMode("single")}
          className={mode === "single" ? "instrument-card instrument-card-active" : "instrument-card"}
        >
          <span className="font-display text-xl">Strumento singolo</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Entrambe le mani suonano lo stesso patch.
          </span>
        </button>
        <button
          onClick={() => setMode("split")}
          className={mode === "split" ? "instrument-card instrument-card-active" : "instrument-card"}
        >
          <span className="font-display text-xl">Split: pad + bass</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Mano sinistra e mano destra con strumenti diversi.
          </span>
        </button>
      </div>

      {mode === "single" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Mano sinistra
            </label>
            <select
              className={`mt-2 ${selectClass}`}
              value={leftInstrument}
              onChange={(e) => setLeftInstrument(e.target.value as InstrumentId)}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Mano destra
            </label>
            <select
              className={`mt-2 ${selectClass}`}
              value={rightInstrument}
              onChange={(e) => setRightInstrument(e.target.value as InstrumentId)}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Scala e tonica */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Scala</label>
          <select
            className={`mt-2 ${selectClass}`}
            value={scale}
            onChange={(e) => setScale(e.target.value as ScaleId)}
          >
            {SCALES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Tonica</label>
          <select
            className={`mt-2 ${selectClass}`}
            value={rootPc}
            onChange={(e) => setRootPc(Number(e.target.value))}
          >
            {NOTE_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Arpeggiatore */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-foreground">Arpeggiatore</h2>
            <p className="text-xs text-muted-foreground">
              Ritmizza automaticamente le note della scala scelta.
            </p>
          </div>
          <button
            onClick={() => setArpOn((v) => !v)}
            className={arpOn ? "btn-hero" : "btn-ghost"}
            aria-pressed={arpOn}
          >
            {arpOn ? "On" : "Off"}
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Pattern
            </label>
            <select
              className={`mt-2 ${selectClass}`}
              value={arpPattern}
              onChange={(e) => setArpPattern(e.target.value as ArpPatternId)}
            >
              {ARP_PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Velocità: {arpRate} note/s
            </label>
            <input
              type="range"
              min={2}
              max={16}
              step={1}
              value={arpRate}
              onChange={(e) => setArpRate(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
          </div>
        </div>
      </div>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ["Sinistra / destra", "Sposta la mano in orizzontale per cambiare grado della scala."],
          [
            "Alto / basso",
            "Alza la mano per aprire il filtro (e accelerare il wobble), abbassala per scurire.",
          ],
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
