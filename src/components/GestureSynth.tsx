import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardMusic, Music4, Repeat, SlidersHorizontal, Square } from "lucide-react";
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
type PanelId = "sound" | "fx" | "scale" | "arp";
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  hue: number;
};

const PINCH_TIPS = [8, 12, 16, 20];
const PINCH_OFFSETS = [0, 2, 4, 6];

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const STEPS = 21;


export default function GestureSynth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GestureSynthEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const voiceIdsRef = useRef<Set<string>>(new Set());
  const particlesRef = useRef<Particle[]>([]);
  const hueRef = useRef(0);


  const [panel, setPanel] = useState<PanelId | null>(null);
  const [mode, setMode] = useState<PlayMode>("split");
  const [instrument, setInstrument] = useState<InstrumentId>("reese");
  const [leftInstrument, setLeftInstrument] = useState<InstrumentId>("violin");
  const [rightInstrument, setRightInstrument] = useState<InstrumentId>("winds");
  const [scale, setScale] = useState<ScaleId>("minorPent");
  const [rootPc, setRootPc] = useState(2);
  const [arpLeft, setArpLeft] = useState(false);
  const [arpRight, setArpRight] = useState(false);
  const [arpRate, setArpRate] = useState(8);
  const [arpPattern, setArpPattern] = useState<ArpPatternId>("up");
  const [reverb, setReverb] = useState(93);
  const [eqType, setEqType] = useState<"lowpass" | "highpass">("lowpass");
  const [eqFreq, setEqFreq] = useState(1200);


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
    particlesRef.current = [];
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

  useEffect(() => {
    engineRef.current?.setReverb(reverb / 100);
  }, [reverb]);

  useEffect(() => {
    engineRef.current?.setEq(eqType, eqFreq);
  }, [eqType, eqFreq]);


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
        
        const indexTip = pts[8]!;
        const thumbTip = pts[4]!;
        const middleTip = pts[12]!;

        // mirrored view: MediaPipe "Left" is the user's right hand
        const isRight = res.handedness?.[i]?.[0]?.categoryName === "Left";
        const inst: InstrumentId = m === "split" ? (isRight ? ri : li) : single;
        const arp = isRight ? aR : aL;

        const x = 1 - indexTip.x;
        const bright = 1 - Math.min(1, Math.max(0, indexTip.y));

        const list = particlesRef.current;
        const baseHue = isRight ? 20 : 190;
        let soundLevel = 0;
        const glows: { x: number; y: number; hue: number; level: number }[] = [];

        if (m === "pinch") {
          // tocco: quattro note per lato
          const base = positionToDegree(x, 8);
          PINCH_TIPS.forEach((tipIdx, k) => {
            const tip = pts[tipIdx]!;
            const vid = `${id}f${k}`;
            const d = Math.hypot(tip.x - thumbTip.x, tip.y - thumbTip.y);
            const on = d < 0.07;
            if (on) {
              active.add(vid);
              const level = Math.min(1, Math.max(0.35, 1 - d / 0.07));
              soundLevel = Math.max(soundLevel, level);
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
                hand: isRight ? "Lato B" : "Lato A",
                inst: INSTRUMENTS.find((x2) => x2.id === inst)?.name ?? "",
              });
              // punto di contatto (fra pollice e dito)
              const cx = (1 - (tip.x + thumbTip.x) / 2) * canvas.width;
              const cy = ((tip.y + thumbTip.y) / 2) * canvas.height;
              glows.push({ x: cx, y: cy, hue: (baseHue + k * 30) % 360, level });

              // scintille dal punto di contatto
              for (let s = 0; s < 4; s++) {
                if (list.length > 900) break;
                const a = Math.random() * Math.PI * 2;
                const sp = 1 + Math.random() * 3 * level;
                list.push({
                  x: cx,
                  y: cy,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp - 0.6,
                  life: 1,
                  decay: 0.015 + Math.random() * 0.02,
                  size: 2 + Math.random() * 4,
                  hue: (hueRef.current + baseHue + k * 30) % 360,
                });
              }
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
            soundLevel = level;
            if (arp) engine.setArpTarget(id, degree, level, bright, inst);
            else engine.noteOn(id, midiToFreq(midi), level, bright, inst);
            next.push({
              note: midiToName(midi),
              level,
              hand: isRight ? "Lato B" : "Lato A",
              inst: INSTRUMENTS.find((x2) => x2.id === inst)?.name ?? "",
            });
          } else {
            active.delete(id);
          }
        }

        // scheletro ben visibile
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 18;
        ctx.shadowColor = `hsla(${baseHue}, 100%, 60%, 0.9)`;
        ctx.strokeStyle = `hsla(${baseHue}, 100%, 70%, ${0.55 + soundLevel * 0.45})`;
        ctx.lineWidth = 5;
        HAND_CONNECTIONS.forEach(([a, b]) => {
          const p1 = pts[a];
          const p2 = pts[b];
          if (!p1 || !p2) return;
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        });
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        HAND_CONNECTIONS.forEach(([a, b]) => {
          const p1 = pts[a];
          const p2 = pts[b];
          if (!p1 || !p2) return;
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        });
        ctx.shadowBlur = 12;
        ctx.shadowColor = `hsla(${baseHue}, 100%, 65%, 0.9)`;
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.fill();
        });
        ctx.restore();

        // bagliore sul punto di contatto
        if (glows.length) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          glows.forEach((gl) => {
            const r = 26 + gl.level * 34;
            const grd = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, r);
            grd.addColorStop(0, `hsla(${gl.hue}, 100%, 92%, ${0.9 * gl.level})`);
            grd.addColorStop(0.35, `hsla(${gl.hue}, 100%, 65%, ${0.5 * gl.level})`);
            grd.addColorStop(1, `hsla(${gl.hue}, 100%, 50%, 0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(gl.x, gl.y, r, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        }

        // particelle solo quando esce suono, emesse dalla mano
        if (soundLevel > 0) {
          pts.forEach((p, pi) => {
            if (list.length > 900) return;
            if (Math.random() > 0.18 * (0.3 + soundLevel)) return;
            const a = Math.random() * Math.PI * 2;
            const sp = 0.4 + Math.random() * 1.6 * soundLevel;
            list.push({
              x: (1 - p.x) * canvas.width,
              y: p.y * canvas.height,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 0.4,
              life: 1,
              decay: 0.012 + Math.random() * 0.02,
              size: 2 + Math.random() * 5 * (0.5 + soundLevel),
              hue: (hueRef.current + pi * 12 + (isRight ? 120 : 0)) % 360,
            });
          });
        }

      });

      // update + draw particelle
      hueRef.current = (hueRef.current + 2.5) % 360;
      const parts = particlesRef.current;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.life -= p.decay;
        p.hue = (p.hue + 4) % 360;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        const r = p.size * (0.4 + p.life);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
        g.addColorStop(0, `hsla(${p.hue}, 100%, 72%, ${0.85 * p.life})`);
        g.addColorStop(1, `hsla(${(p.hue + 60) % 360}, 100%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();


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
      engine.reverbAmount = reverb / 100;
      engine.eqType = eqType;
      engine.eqFreq = eqFreq;
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
      setStatus("Impossibile accedere alla fotocamera o all'audio.");
      setRunning(false);
    }
  }, [instrument, scale, rootPc, arpLeft, arpRight, arpRate, arpPattern, reverb, eqType, eqFreq, loop]);

  const pickInstrument = (id: InstrumentId) => {
    setInstrument(id);
    engineRef.current?.setInstrument(id);
  };

  const selectClass =
    "w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground";

  const panelBtn = (id: PanelId, label: string, Icon: any) => (
    <button
      key={id}
      onClick={() => setPanel((p) => (p === id ? null : id))}
      aria-label={label}
      aria-pressed={panel === id}
      className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-[11px] transition ${
        panel === id
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <header className="text-center">
        <h1 className="font-display text-2xl leading-tight text-foreground sm:text-3xl">
          STEPH EVO'S <span className="text-primary">CRAZY THERAMIN</span>
        </h1>
      </header>

      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-card shadow-glow">
        <div className="relative aspect-[3/4] w-full bg-stage sm:aspect-[4/3]">
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-2 p-3">
              {hands.length === 0 ? (
                <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                  Pronto
                </span>
              ) : (
                hands.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-background/70 px-3 py-1 text-xs text-foreground backdrop-blur"
                  >
                    {h.hand} · {h.inst}: <strong className="text-primary">{h.note}</strong>{" "}
                    {Math.round(h.level * 100)}%
                  </span>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Barra icone */}
      <div className="mt-4 flex gap-2">
        {panelBtn("sound", "Suono", Music4)}
        {panelBtn("fx", "Effetti", SlidersHorizontal)}
        {panelBtn("scale", "Scala", KeyboardMusic)}
        {panelBtn("arp", "Arp", Repeat)}
        {running && (
          <button
            onClick={stop}
            aria-label="Stop"
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-border bg-card px-2 py-3 text-[11px] text-muted-foreground"
          >
            <Square className="h-6 w-6" />
            Stop
          </button>
        )}
      </div>

      {/* Pannelli */}
      {panel === "sound" && (
        <div className="mt-3 rounded-3xl border border-border bg-card p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["single", "Strumento singolo", "Un solo patch per tutto."],
                ["split", "Doppio strumento", "Due strumenti separati, lato A e lato B."],
                ["pinch", "Tocco note", "Quattro note per lato, sempre in scala."],
              ] as [PlayMode, string, string][]
            ).map(([id, name, blurb]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={mode === id ? "instrument-card instrument-card-active" : "instrument-card"}
              >
                <span className="font-display text-lg">{name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{blurb}</span>
              </button>
            ))}
          </div>

          {mode !== "split" ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {INSTRUMENTS.map((i) => (
                <button
                  key={i.id}
                  onClick={() => pickInstrument(i.id)}
                  className={
                    instrument === i.id ? "instrument-card instrument-card-active" : "instrument-card"
                  }
                >
                  <span className="font-display text-lg">{i.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{i.blurb}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Lato A
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
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Lato B
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
        </div>
      )}

      {panel === "scale" && (
        <div className="mt-3 grid gap-3 rounded-3xl border border-border bg-card p-4 sm:grid-cols-2">
          <div>
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
          <div>
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
      )}

      {panel === "arp" && (
        <div className="mt-3 rounded-3xl border border-border bg-card p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setArpLeft((v) => !v)}
              className={arpLeft ? "btn-hero" : "btn-ghost"}
              aria-pressed={arpLeft}
            >
              Lato A: {arpLeft ? "On" : "Off"}
            </button>
            <button
              onClick={() => setArpRight((v) => !v)}
              className={arpRight ? "btn-hero" : "btn-ghost"}
              aria-pressed={arpRight}
            >
              Lato B: {arpRight ? "On" : "Off"}
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
      )}

      {panel === "fx" && (
        <div className="mt-3 grid gap-4 rounded-3xl border border-border bg-card p-4 sm:grid-cols-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Riverbero: {reverb}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={reverb}
              onChange={(e) => setReverb(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Filtro EQ
            </label>
            <select
              className={`mt-2 ${selectClass}`}
              value={eqType}
              onChange={(e) => setEqType(e.target.value as "lowpass" | "highpass")}
            >
              <option value="lowpass">Low pass</option>
              <option value="highpass">High pass</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Cutoff: {eqFreq >= 1000 ? `${(eqFreq / 1000).toFixed(1)} kHz` : `${eqFreq} Hz`}
            </label>
            <input
              type="range"
              min={60}
              max={16000}
              step={20}
              value={eqFreq}
              onChange={(e) => setEqFreq(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

