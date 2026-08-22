import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, KeyboardMusic, Music4, Repeat, SlidersHorizontal, Square } from "lucide-react";

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
type PanelId = "sound" | "fx" | "scale" | "arp" | "calib";
type CalibPhase = "idle" | "open" | "closed";

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

type Star = {
  x: number;
  y: number;
  size: number;
  phase: number;
  depth: number;
};

const generateStars = (w: number, h: number): Star[] => {
  const count = Math.floor((w * h) / 3200);
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    size: Math.random() < 0.85 ? 0.6 + Math.random() * 1.0 : 1.4 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
    depth: 0.3 + Math.random() * 0.7,
  }));
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

const CALIB_KEY = "cth-calibration-v1";
const DEFAULT_CALIB = { on: 0.42, off: 0.62 };

export default function GestureSynth() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GestureSynthEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const voiceIdsRef = useRef<Set<string>>(new Set());
  const particlesRef = useRef<Particle[]>([]);
  const hueRef = useRef(0);
  // taratura tocco dita-pollice (distanze normalizzate sulla dimensione della mano)
  const calibRef = useRef({ ...DEFAULT_CALIB });
  const sensRef = useRef(0); // -0.15 .. +0.15
  const calibPhaseRef = useRef<CalibPhase>("idle");
  const calibSamplesRef = useRef<{ open: number[]; closed: number[] }>({ open: [], closed: [] });
  const heldRef = useRef<Set<string>>(new Set());
  const smoothRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const liveRatioRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const musicLevelRef = useRef(0);
  const lastSizeRef = useRef({ width: 0, height: 0 });



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

  const [sensitivity, setSensitivity] = useState(0); // -15..+15 (%)
  const [calibPhase, setCalibPhase] = useState<CalibPhase>("idle");
  const [calib, setCalib] = useState({ ...DEFAULT_CALIB });
  const [calibrated, setCalibrated] = useState(false);

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
    heldRef.current.clear();
    smoothRef.current.clear();
    musicLevelRef.current = 0;
    calibPhaseRef.current = "idle";
    setCalibPhase("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  // carica taratura salvata
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CALIB_KEY);
      if (!raw) return;
      const v = JSON.parse(raw) as { on: number; off: number; sensitivity?: number };
      if (typeof v.on === "number" && typeof v.off === "number") {
        calibRef.current = { on: v.on, off: v.off };
        setCalib({ on: v.on, off: v.off });
        setCalibrated(true);
      }
      if (typeof v.sensitivity === "number") {
        setSensitivity(v.sensitivity);
        sensRef.current = v.sensitivity / 100;
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    sensRef.current = sensitivity / 100;
  }, [sensitivity]);


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

  const saveCalib = (on: number, off: number) => {
    try {
      localStorage.setItem(
        CALIB_KEY,
        JSON.stringify({ on, off, sensitivity: sensRef.current * 100 }),
      );
    } catch {
      /* ignore */
    }
  };

  const runCalibration = useCallback(() => {
    calibSamplesRef.current = { open: [], closed: [] };
    calibPhaseRef.current = "open";
    setCalibPhase("open");
    window.setTimeout(() => {
      calibPhaseRef.current = "closed";
      setCalibPhase("closed");
      window.setTimeout(() => {
        calibPhaseRef.current = "idle";
        setCalibPhase("idle");
        const med = (a: number[]) => {
          if (!a.length) return NaN;
          const s = [...a].sort((x, y) => x - y);
          return s[Math.floor(s.length / 2)]!;
        };
        const openV = med(calibSamplesRef.current.open);
        const closedV = med(calibSamplesRef.current.closed);
        if (!isFinite(openV) || !isFinite(closedV) || openV - closedV < 0.06) {
          setStatus("Taratura non riuscita: ripeti tenendo la mano ben visibile.");
          window.setTimeout(() => setStatus(""), 3500);
          return;
        }
        const on = closedV + (openV - closedV) * 0.35;
        const off = closedV + (openV - closedV) * 0.6;
        calibRef.current = { on, off };
        setCalib({ on, off });
        setCalibrated(true);
        saveCalib(on, off);
      }, 3200);
    }, 3200);
  }, []);

  const resetCalibration = useCallback(() => {
    calibRef.current = { ...DEFAULT_CALIB };
    setCalib({ ...DEFAULT_CALIB });
    setCalibrated(false);
    setSensitivity(0);
    sensRef.current = 0;
    try {
      localStorage.removeItem(CALIB_KEY);
    } catch {
      /* ignore */
    }
  }, []);


  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarkerRef.current;
    const engine = engineRef.current;
    if (!video || !canvas || !lm || !engine) return;

    const ctx = canvas.getContext("2d");
    if (ctx && video.videoWidth) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (canvas.width !== w || canvas.height !== h || lastSizeRef.current.width !== w || lastSizeRef.current.height !== h) {
        canvas.width = w;
        canvas.height = h;
        lastSizeRef.current = { width: w, height: h };
        starsRef.current = generateStars(w, h);
      }

      const now = performance.now();

      // sfondo scuro del palco
      ctx.fillStyle = "rgb(16, 16, 23)";
      ctx.fillRect(0, 0, w, h);

      // stelline lontane che respirano col volume
      const ml = musicLevelRef.current;
      const baseStarAlpha = 0.03;
      const stars = starsRef.current;
      ctx.save();
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]!;
        const breath = 0.5 + 0.5 * Math.sin(now * 0.0025 * s.depth + s.phase);
        const alpha = baseStarAlpha + 0.35 * ml * s.depth * breath;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.85, alpha)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const res = lm.detectForVideo(video, now);
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

      let maxSoundLevel = 0;
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

        // dimensione della mano: rende le soglie indipendenti dalla distanza dalla camera
        const wrist = pts[0]!;
        const midMcp = pts[9]!;
        const handSize =
          Math.hypot(wrist.x - midMcp.x, wrist.y - midMcp.y) || 0.12;
        const indexRatio = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) / handSize;
        if (i === 0) liveRatioRef.current = indexRatio;
        if (calibPhaseRef.current === "open") calibSamplesRef.current.open.push(indexRatio);
        else if (calibPhaseRef.current === "closed") calibSamplesRef.current.closed.push(indexRatio);

        const sens = sensRef.current;
        const thrOn = calibRef.current.on * (1 - sens);
        const thrOff = Math.max(thrOn + 0.04, calibRef.current.off * (1 - sens));

        const list = particlesRef.current;
        const baseHue = isRight ? 44 : 36;
        let soundLevel = 0;
        const glows: { x: number; y: number; hue: number; level: number }[] = [];

        if (m === "pinch") {
          // tocco: quattro note per lato
          const base = positionToDegree(x, 8);
          PINCH_TIPS.forEach((tipIdx, k) => {
            const tip = pts[tipIdx]!;
            const vid = `${id}f${k}`;
            const ratio = Math.hypot(tip.x - thumbTip.x, tip.y - thumbTip.y) / handSize;
            // isteresi: entra sotto thrOn, resta attivo fino a thrOff
            const wasOn = heldRef.current.has(vid);
            const on = wasOn ? ratio < thrOff : ratio < thrOn;
            if (on) heldRef.current.add(vid);
            else heldRef.current.delete(vid);
            if (on) {
              active.add(vid);
              const level = Math.min(1, Math.max(0.35, 1 - ratio / thrOff));
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
              // punto di contatto: media pesata polpastrelli + smoothing temporale
              const thumbIp = pts[3] ?? thumbTip;
              const tipDip = pts[tipIdx - 1] ?? tip;
              const rawX =
                (1 - (tip.x * 0.4 + thumbTip.x * 0.4 + tipDip.x * 0.1 + thumbIp.x * 0.1)) *
                canvas.width;
              const rawY =
                (tip.y * 0.4 + thumbTip.y * 0.4 + tipDip.y * 0.1 + thumbIp.y * 0.1) * canvas.height;
              const prev = smoothRef.current.get(vid);
              const cx = prev ? prev.x + (rawX - prev.x) * 0.45 : rawX;
              const cy = prev ? prev.y + (rawY - prev.y) * 0.45 : rawY;
              smoothRef.current.set(vid, { x: cx, y: cy });
              glows.push({ x: cx, y: cy, hue: 38 + k * 3, level });

              // scintille dal punto di contatto: minuscole e brevissime
              for (let s = 0; s < 6; s++) {
                if (list.length > 1400) break;
                const a = Math.random() * Math.PI * 2;
                const sp = 1.8 + Math.random() * 4.5 * level;
                list.push({
                  x: cx,
                  y: cy,
                  vx: Math.cos(a) * sp,
                  vy: Math.sin(a) * sp - 0.8,
                  life: 0.35 + Math.random() * 0.25,
                  decay: 0.03 + Math.random() * 0.035,
                  size: 0.25 + Math.random() * 0.5,
                  hue: 34 + Math.random() * 16,
                });
              }
            } else {
              smoothRef.current.delete(vid);
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
          // normalizzato sulla dimensione della mano + taratura
          const span = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y) / handSize;
          const level = Math.min(1, Math.max(0, (span - thrOn) / Math.max(0.2, thrOff * 1.8)));


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

        maxSoundLevel = Math.max(maxSoundLevel, soundLevel);

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

        // particelle solo quando esce suono, piccole e volanti a lungo
        if (soundLevel > 0) {
          pts.forEach((p, pi) => {
            if (list.length > 1400) return;
            if (Math.random() > 0.12 * (0.25 + soundLevel)) return;
            const a = Math.random() * Math.PI * 2;
            const sp = 1.2 + Math.random() * 3.2 * soundLevel;
            list.push({
              x: (1 - p.x) * canvas.width,
              y: p.y * canvas.height,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 0.5,
              life: 0.4 + Math.random() * 0.3,
              decay: 0.028 + Math.random() * 0.035,
              size: 0.22 + Math.random() * 0.6 * (0.4 + soundLevel),
              hue: 32 + Math.random() * 18 + pi * 0.2,
            });
          });
        }

      });

      musicLevelRef.current = musicLevelRef.current * 0.92 + maxSoundLevel * 0.08;

      // update + draw particelle
      hueRef.current = (hueRef.current + 2.5) % 360;
      const parts = particlesRef.current;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.015;
        p.vx *= 0.993;
        p.vy *= 0.993;
        p.life -= p.decay;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        const r = p.size * (0.4 + p.life * 0.8);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
        g.addColorStop(0, `hsla(${p.hue}, 80%, 82%, ${0.85 * p.life})`);
        g.addColorStop(1, `hsla(${p.hue}, 75%, 55%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 2.4, 0, Math.PI * 2);
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
      className={`flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-[11px] transition ${
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
          {calibPhase !== "idle" && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-1 bg-background/70 p-3 text-center backdrop-blur">
              <span className="font-display text-lg text-primary">
                {calibPhase === "open" ? "1/2 · Dita aperte" : "2/2 · Unisci pollice e indice"}
              </span>
              <span className="text-xs text-muted-foreground">
                Tieni la posizione per qualche secondo…
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Barra icone */}
      <div className="mt-4 flex flex-wrap gap-2">
        {panelBtn("sound", "Suono", Music4)}
        {panelBtn("fx", "Effetti", SlidersHorizontal)}
        {panelBtn("scale", "Scala", KeyboardMusic)}
        {panelBtn("arp", "Arp", Repeat)}
        {panelBtn("calib", "Taratura", Crosshair)}

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

      {panel === "calib" && (
        <div className="mt-3 rounded-3xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            La taratura misura la tua mano e regola quando il contatto tra pollice e dito viene
            riconosciuto. Serve la fotocamera attiva.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={runCalibration}
              disabled={!running || calibPhase !== "idle"}
              className={running && calibPhase === "idle" ? "btn-hero" : "btn-ghost opacity-60"}
            >
              {calibPhase === "idle" ? "Avvia taratura" : "Taratura in corso…"}
            </button>
            <button onClick={resetCalibration} className="btn-ghost">
              Ripristina
            </button>
            <span className="text-xs text-muted-foreground">
              {calibrated ? "Profilo personale attivo" : "Profilo predefinito"} · soglia{" "}
              {calib.on.toFixed(2)} / rilascio {calib.off.toFixed(2)}
            </span>
          </div>

          {!running && (
            <p className="mt-2 text-xs text-muted-foreground">
              Avvia prima la vista live per poter tarare.
            </p>
          )}

          <div className="mt-4">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Sensibilità: {sensitivity > 0 ? `+${sensitivity}` : sensitivity}
            </label>
            <input
              type="range"
              min={-15}
              max={15}
              step={1}
              value={sensitivity}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSensitivity(v);
                sensRef.current = v / 100;
                if (calibrated) saveCalib(calib.on, calib.off);
              }}
              className="mt-3 w-full accent-[var(--primary)]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Più a destra = serve un contatto più stretto; più a sinistra = risposta più facile.
            </p>
          </div>
        </div>
      )}
    </div>

  );
}

