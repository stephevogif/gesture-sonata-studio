import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Circle,
  Eye,
  EyeOff,
  HelpCircle,
  Music2,
  Pause,
  Play,
  Repeat,
  Settings2,
  Sliders,
  Square,
  Trash2,
} from "lucide-react";
import {
  GestureSynthEngine,
  INSTRUMENTS,
  INSTRUMENT_SHIFT,
  type InstrumentId,
} from "@/lib/synth";
import {
  buildChord,
  KEYS,
  MODES,
  midiName,
  midiToFreq,
  ROMAN,
  scaleNoteNames,
  type Chord,
  type ModeId,
} from "@/lib/theory";
import { Debouncer, heightToGain, Smoother, type HandFrame } from "@/lib/gestures";
import { Looper, STEPS_PER_BAR, emptyTracks, type LoopTrack } from "@/lib/looper";
import { useHandTracking, type TrackingFrame } from "@/hooks/useHandTracking";
import TutorialArt from "@/components/TutorialArt";

type PanelId = null | "sound" | "fx" | "scale" | "loop" | "help";

type Hud = {
  volume: number;
  filter: number;
  heavens: {
    leftCount: number;
    rightCount: number;
    total: number;
    degree: number | null;
    label: string;
    notes: string;
  } | null;
  fps: number;
};



const ONBOARD_KEY = "sky-studio-onboarded";

const STEPS = [
  { a: "camera" as const, t: "Fotocamera e tracciamento", d: "Concedi l'accesso alla fotocamera: vedrai te stesso nel cielo, con le mani illuminate come costellazioni." },
  { a: "fingers" as const, t: "7 Heavens", d: "Le dita totali delle due mani (1–7) scelgono l'accordo I–VII della scala scelta." },
  { a: "height" as const, t: "Lato A = filtro", d: "Alza o abbassa la mano A: apre e chiude il low pass risonante degli accordi." },
  { a: "height" as const, t: "Lato B = volume", d: "Alza o abbassa la mano B per controllare il volume." },
  { a: "settings" as const, t: "Suono ed effetti", d: "Strumento nel pannello Suono; riverbero, delay, risonanza e cutoff nel pannello Effetti." },
  { a: "loop" as const, t: "Loop pedal", d: "Registra fino a 4 tracce con click di preconteggio: si avviano in automatico." },
  { a: "keys" as const, t: "Scorciatoie", d: "Spazio = play/pausa, 1–4 traccia, M mute, S solo, Canc svuota, Shift+Canc svuota tutto." },
];


/** sprite morbido riutilizzabile (evita gradienti creati a ogni frame) */
function makeBlobSprite(size: number, rgb: string) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.45, `rgba(${rgb},0.6)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

function makeSunSprite(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,252,235,1)");
  g.addColorStop(0.35, "rgba(255,238,180,0.7)");
  g.addColorStop(0.7, "rgba(255,220,140,0.25)");
  g.addColorStop(1, "rgba(255,214,140,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}

export default function HeavenSynth() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GestureSynthEngine | null>(null);
  const cloudsRef = useRef<{ x: number; y: number; r: number; v: number; a: number }[]>([]);
  const sunRef = useRef({ p: -0.25, y: 0.3 });
  const skyCache = useRef<{ w: number; h: number; grad: CanvasGradient | null }>({ w: 0, h: 0, grad: null });
  const cloudSprite = useRef<HTMLCanvasElement | null>(null);
  const sunSprite = useRef<HTMLCanvasElement | null>(null);
  const fadeRef = useRef(0);
  const lastFrameRef = useRef(0);

  const glowRef = useRef(0);

  const activeIdsRef = useRef<string[]>([]);
  const prevNotesRef = useRef<number[]>([]);
  const currentRef = useRef<{ chord: Chord | null; volume: number; filter: number }>({
    chord: null,
    volume: 0,
    filter: 8000,
  });

  const heavensDeb = useRef(new Debouncer<number | null>(150));
  const volSm = useRef(new Smoother(0.16));
  const cutSm = useRef(new Smoother(0.14));

  // ————— impostazioni —————
  const [rootPc, setRootPc] = useState(9);
  const [mode, setMode] = useState<ModeId>("major");
  const [instrument, setInstrument] = useState<InstrumentId>("pads");
  const [showDebug, setShowDebug] = useState(true);
  const [panel, setPanel] = useState<PanelId>(null);
  const [hud, setHud] = useState<Hud>({ volume: 0, filter: 8000, heavens: null, fps: 0 });

  // ————— effetti (come Sky Synth) —————
  const [reverb, setReverb] = useState(45);
  const [delayMix, setDelayMix] = useState(24);
  const [delayFeedback, setDelayFeedback] = useState(32);
  const [cutMax, setCutMax] = useState(8000);
  const [resonance, setResonance] = useState(6);

  const [onboard, setOnboard] = useState(0);
  const [showOnboard, setShowOnboard] = useState(false);

  // ————— loop pedal —————
  const [bpm, setBpm] = useState(100);
  const [bars, setBars] = useState(2);
  const [loop, setLoop] = useState({
    playing: false,
    recording: false,
    countIn: false,
    step: 0,
    selected: 0,
    tracks: emptyTracks(),
  });
  const looperRef = useRef<Looper | null>(null);

  const cfg = useRef({ rootPc, mode, instrument, showDebug, cutMax });
  useEffect(() => {
    cfg.current = { rootPc, mode, instrument, showDebug, cutMax };
    engineRef.current?.setInstrument(instrument);
  }, [rootPc, mode, instrument, showDebug, cutMax]);

  useEffect(() => {
    engineRef.current?.setReverb(reverb / 100);
  }, [reverb]);
  useEffect(() => {
    engineRef.current?.setDelay({ mix: delayMix / 100, feedback: delayFeedback / 100 });
  }, [delayMix, delayFeedback]);
  useEffect(() => {
    engineRef.current?.setResonance(resonance);
  }, [resonance]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(ONBOARD_KEY)) setShowOnboard(true);
  }, []);

  const noteNames = useMemo(() => scaleNoteNames(rootPc, mode), [rootPc, mode]);

  /* ————— audio ————— */

  const releaseAll = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    activeIdsRef.current.forEach((id) => e.noteOff(id, true));
    activeIdsRef.current = [];
    prevNotesRef.current = [];
    currentRef.current.chord = null;
  }, []);

  const applyNotes = useCallback((notes: number[], gain: number, bright: number) => {
    const e = engineRef.current;
    if (!e) return;
    const inst = cfg.current.instrument;
    const shift = INSTRUMENT_SHIFT[inst] ?? 0;
    const ids = notes.map((_, i) => `ch${i}`);
    activeIdsRef.current
      .filter((id) => !ids.includes(id))
      .forEach((id) => e.noteOff(id, true));
    notes.forEach((m, i) => {
      const amp = gain * (i === 0 ? 1 : 0.7);
      e.noteOn(ids[i]!, midiToFreq(m + shift), Math.max(0.02, amp), bright, inst);
    });
    activeIdsRef.current = ids;
  }, []);

  /* ————— loop pedal ————— */

  const getLooper = useCallback(() => {
    if (looperRef.current) return looperRef.current;
    const l = new Looper({
      bpm,
      bars,
      onEvent: (track, ev) => {
        const e = engineRef.current;
        if (!e) return;
        const inst = cfg.current.instrument;
        const shift = INSTRUMENT_SHIFT[inst] ?? 0;
        const dur = (60 / Math.max(30, l.bpm) / 4) * 3.2;
        ev.notes.forEach((m, i) => {
          const id = `lp${track.id}-${i}`;
          e.noteOn(id, midiToFreq(m + shift), ev.volume * track.volume * 0.8, 0.5, inst);
          setTimeout(() => e.noteOff(id, true), dur * 1000);
        });
      },
      capture: () => {
        const c = currentRef.current;
        if (!c.chord) return null;
        return {
          notes: c.chord.notes,
          label: c.chord.label,
          volume: Math.max(0.2, c.volume),
          filter: c.filter,
        };
      },
      onState: (patch) => setLoop((s) => ({ ...s, ...patch }) as typeof s),
    });
    looperRef.current = l;
    return l;
  }, [bpm, bars]);

  useEffect(() => {
    looperRef.current?.setBpm(bpm);
    engineRef.current?.setTempo(bpm);
  }, [bpm]);
  useEffect(() => {
    looperRef.current?.setBars(bars);
  }, [bars]);
  useEffect(() => () => looperRef.current?.dispose(), []);

  /* ————— rendering ————— */

  const drawSky = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, glow: number, fade: number, dt: number, music: number) => {
      // il canvas è TRASPARENTE: sotto c'è il cielo dipinto (CSS)
      ctx.clearRect(0, 0, w, h);

      const cache = skyCache.current;
      if (cache.w !== w || cache.h !== h) {
        cache.w = w;
        cache.h = h;
        cloudsRef.current = [];
      }

      if (!cloudSprite.current) cloudSprite.current = makeBlobSprite(256, "255,246,232");
      if (!sunSprite.current) sunSprite.current = makeSunSprite(256);

      if (cloudsRef.current.length === 0) {
        cloudsRef.current = Array.from({ length: 12 }, () => ({
          x: Math.random() * w,
          y: h * (0.55 + Math.random() * 0.5),
          r: h * (0.14 + Math.random() * 0.3),
          v: 4 + Math.random() * 14,
          a: 0.08 + Math.random() * 0.16,
        }));
      }

      const t = performance.now() / 1000;
      const sun = sunSprite.current!;
      const cloud = cloudSprite.current!;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // ————— sole: tre cerchi concentrici con respiro sfasato —————
      if (music > 0.004) {
        const sx = w * 0.5;
        const sy = h * 0.72;
        const base = Math.min(w, h) * 0.12;
        for (let i = 0; i < 3; i++) {
          const osc = Math.sin(t * 0.9 - i * 0.8);
          const r = base * (1 + i * 0.95) * (1 + osc * (0.05 + glow * 0.16));
          const a = [0.55, 0.26, 0.13][i]! * music * (0.55 + glow * 0.6) * (0.85 + osc * 0.15);
          ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(sun, sx - r, sy - r, r * 2, r * 2);
        }
      }

      // ————— nuvole leggerissime, sempre in viaggio —————
      for (const c of cloudsRef.current) {
        c.x += c.v * (1 + glow * 1.1) * dt;
        if (c.x - c.r > w) {
          c.x = -c.r;
          c.y = h * (0.55 + Math.random() * 0.5);
          c.r = h * (0.14 + Math.random() * 0.3);
          c.v = 4 + Math.random() * 14;
          c.a = 0.08 + Math.random() * 0.16;
        }
        ctx.globalAlpha = Math.min(1, c.a * (0.55 + fade * 0.25 + glow * 0.35));
        ctx.drawImage(cloud, c.x - c.r, c.y - c.r * 0.7, c.r * 2, c.r * 1.4);
      }
      ctx.restore();
    },
    [],
  );

  /* ————— particelle emesse dal tracciamento quando suona un accordo ————— */

  const emitParticles = useCallback((hand: HandFrame, w: number, h: number, amount: number) => {
    const tips = [4, 8, 12, 16, 20, 0];
    const arr = particlesRef.current;
    if (arr.length > 420) return;
    for (const i of tips) {
      if (Math.random() > amount) continue;
      const lm = hand.landmarks[i]!;
      const x = (1 - lm.x) * w;
      const y = lm.y * h;
      const ang = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 46;
      arr.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 14,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        r: 0.9 + Math.random() * 1.8,
      });
    }
  }, []);

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, dt: number) => {
    const arr = particlesRef.current;
    if (!arr.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i]!;
      p.life -= dt * 1.5;
      if (p.life <= 0) {
        arr.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 26 * dt;
      p.vx *= 1 - dt * 1.2;
      const a = Math.max(0, p.life) * 0.85;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(255,240,205,1)";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(255,214,140,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }, []);

  const drawHand = useCallback(
    (ctx: CanvasRenderingContext2D, hand: HandFrame, w: number, h: number) => {
      const lm = hand.landmarks;
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
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // contorno morbido scuro: contrasto leggibile sul cielo chiaro
      ctx.strokeStyle = "rgba(46,68,110,0.35)";
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      for (const [a, b] of links) {
        ctx.moveTo(px(a!), py(a!));
        ctx.lineTo(px(b!), py(b!));
      }
      ctx.stroke();

      // costellazione ivory/oro
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(255,226,160,0.85)";
      ctx.strokeStyle = "rgba(255,248,228,0.9)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const [a, b] of links) {
        ctx.moveTo(px(a!), py(a!));
        ctx.lineTo(px(b!), py(b!));
      }
      ctx.stroke();

      for (let i = 0; i < 21; i++) {
        const r = i % 4 === 0 ? 3.6 : 2.4;
        ctx.beginPath();
        ctx.fillStyle = "rgba(255,250,235,0.98)";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(255,214,140,0.95)";
        ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    [],
  );



  /* ————— loop di tracking ————— */

  const hudTick = useRef(0);

  const onFrame = useCallback(
    ({ hands, video, fps }: TrackingFrame) => {
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!canvas || !engine) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const left = hands.find((x) => x.handedness === "left") ?? null;
      const right = hands.find((x) => x.handedness === "right") ?? null;
      const { rootPc: root, mode: md, cutMax: cmax } = cfg.current;

      // ————— Lato B (destra): altezza = volume —————
      const volume = right ? volSm.current.push(heightToGain(right.height)) : volSm.current.push(0);

      // ————— Lato A (sinistra): altezza = low pass risonante —————
      const cutTarget = left ? 260 * Math.pow(Math.max(400, cmax) / 260, left.height) : cmax;
      const cutoff = cutSm.current.push(cutTarget);
      engine.setEq("lowpass", cutoff);
      const bright = Math.max(0.1, Math.min(1, left ? left.height : 0.6));

      let chord: Chord | null = null;
      let heavensHud: Hud["heavens"] = null;

      // 7 HEAVENS: dita totali (sinistra + destra) = grado dell'accordo diatonico
      const lc = left ? Math.max(0, Math.min(5, left.count)) : 0;
      const rc = right ? Math.max(0, Math.min(5, right.count)) : 0;
      const total = lc + rc;
      const stable = heavensDeb.current.push(total >= 1 && total <= 7 ? total : null);
      let deg: number | null = null;
      if (hands.length && stable) {
        deg = stable - 1;
        chord = buildChord({
          rootPc: root,
          mode: md,
          degree: deg,
          tonality: "auto",
          voicing: "triad",
          previous: prevNotesRef.current,
        });
        applyNotes(chord.notes, right ? Math.max(0.06, volume) : 0.6, bright);
        prevNotesRef.current = chord.notes;
        currentRef.current.chord = chord;
      } else {
        releaseAll();
      }
      heavensHud = {
        leftCount: lc,
        rightCount: rc,
        total,
        degree: deg,
        label: chord?.label ?? "—",
        notes: chord ? chord.notes.map((n) => midiName(n)).join(" · ") : "—",
      };


      currentRef.current.volume = volume;
      currentRef.current.filter = cutoff;

      // ————— disegno —————
      const nowMs = performance.now();
      const dt = lastFrameRef.current ? Math.min(0.05, (nowMs - lastFrameRef.current) / 1000) : 0.016;
      lastFrameRef.current = nowMs;
      const target = hands.length ? Math.max(0.2, volume) : 0;
      const k = 1 - Math.exp(-dt * 4);
      glowRef.current += (target - glowRef.current) * k;
      fadeRef.current += ((hands.length ? 1 : 0) - fadeRef.current) * (1 - Math.exp(-dt * (hands.length ? 3 : 1.6)));
      drawSky(ctx, w, h, glowRef.current, fadeRef.current, dt);

      if (cfg.current.showDebug) for (const hand of hands) drawHand(ctx, hand, w, h);

      // ————— HUD (throttle) —————
      const now = performance.now();
      if (now - hudTick.current > 110) {
        hudTick.current = now;
        setHud({ volume, filter: cutoff, heavens: heavensHud, fps });
      }

    },
    [applyNotes, drawHand, drawSky, releaseAll],
  );

  const { videoRef, running, status, start: startCam, stop: stopCam } = useHandTracking(onFrame);

  const start = useCallback(async () => {
    const engine = engineRef.current ?? new GestureSynthEngine();
    engineRef.current = engine;
    await engine.start();
    engine.setChord("off");
    engine.setInstrument(cfg.current.instrument);
    engine.setReverb(reverb / 100);
    engine.setDelay({ mix: delayMix / 100, feedback: delayFeedback / 100 });
    engine.setResonance(resonance);
    engine.setTempo(bpm);
    await startCam();
  }, [bpm, delayFeedback, delayMix, resonance, reverb, startCam]);

  const stop = useCallback(() => {
    stopCam();
    releaseAll();
    engineRef.current?.allOff();
    looperRef.current?.pause();
    setHud({ volume: 0, filter: 8000, heavens: null, fps: 0 });
  }, [releaseAll, stopCam]);


  useEffect(() => () => stop(), [stop]);

  /* ————— scorciatoie ————— */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      const l = getLooper();
      if (e.code === "Space") {
        e.preventDefault();
        l.toggle();
      } else if (/^Digit[1-4]$/.test(e.code)) {
        l.select(Number(e.code.slice(5)) - 1);
      } else if (e.key.toLowerCase() === "m") {
        l.toggleMute();
      } else if (e.key.toLowerCase() === "s") {
        l.toggleSolo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.shiftKey ? l.clearAll() : l.clear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [getLooper]);

  const activeDegree = hud.heavens?.degree ?? null;
  const playing = activeDegree != null;

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
      active
        ? "border-[rgba(255,222,160,0.9)] bg-[rgba(255,238,200,0.28)] text-[#3a2f16] shadow-sm"
        : "border-white/50 bg-white/25 text-[#3f4b62] hover:border-white/80"
    }`;

  return (
    <div className="heaven-scene relative min-h-screen overflow-hidden text-[#33405a]">
      {/* strato camera: sfondo vivo di tutta la pagina */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-cover opacity-70"
        />
        <div className="heaven-veil absolute inset-0" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
        <div className="heaven-vignette absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-32 pt-5">
        {/* header */}
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/" aria-label="Sky Synth" className="heaven-orb-btn">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-white/85 drop-shadow">
              Steph Evo&apos;s
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-white/85 drop-shadow">
              Heaven Synth
            </p>
          </div>
          <button
            onClick={() => setPanel((p) => (p === "help" ? null : "help"))}
            aria-label="Guida"
            className="heaven-orb-btn"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

        </header>

        <h1 className="heaven-title mt-5 text-center text-[2.1rem] leading-none sm:text-5xl">
          SEVEN HEAVENS
        </h1>

        {/* root + scala */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setPanel((p) => (p === "scale" ? null : "scale"))}
            className="heaven-pill"
          >
            {KEYS[rootPc]} · {MODES.find((m) => m.id === mode)?.name.toUpperCase()}
            <span className="ml-2 opacity-70">⌄</span>
          </button>
        </div>

        {/* i sette cieli */}
        <div className="relative mt-7 flex items-center justify-between px-1">
          <div className="heaven-thread pointer-events-none absolute inset-x-2 top-1/2" />
          {ROMAN.slice(0, 7).map((r, i) => (
            <div key={r} className={`heaven-node ${activeDegree === i ? "heaven-node-on" : ""}`}>
              {r}
            </div>
          ))}
        </div>

        {/* current heaven */}
        <div className="mt-10 flex min-h-[190px] flex-col items-center justify-start text-center">
          {playing ? (
            <div key={activeDegree} className="animate-fade-in">
              <p className="text-[10px] font-medium uppercase tracking-[0.5em] text-white/90 drop-shadow">
                Heaven
              </p>
              <p className="heaven-title mt-1 text-[4.2rem] leading-[0.9]">{ROMAN[activeDegree!]}</p>
              <div className="mx-auto mt-3 h-px w-24 bg-white/50" />
              <p className="mt-3 text-2xl font-light uppercase tracking-[0.14em] text-white drop-shadow">
                {hud.heavens?.label}
              </p>
              <p className="mt-1 text-sm tracking-[0.3em] text-[#ffe9bd] drop-shadow">
                {hud.heavens?.notes}
              </p>
            </div>
          ) : (
            <div className="animate-fade-in">
              <p className="text-base font-light uppercase tracking-[0.34em] text-white/95 drop-shadow">
                Reach for a heaven
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-white/70">
                {running ? "Raise your hands to play" : status || "Tocca ▶ per iniziare"}
              </p>
              {!running && (
                <button onClick={start} className="heaven-pill mt-6">
                  Inizia a suonare
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* filtro / volume */}
        {running && (
          <div className="grid grid-cols-2 gap-3">
            <div className="heaven-glass px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.32em] text-white/80">Filter</p>
              <p className="mt-1 text-lg font-light text-white">
                {(hud.filter / 1000).toFixed(1)} kHz
              </p>
              <div className="heaven-meter mt-2">
                <span style={{ width: `${Math.min(100, (hud.filter / Math.max(1000, cutMax)) * 100)}%` }} />
              </div>
            </div>
            <div className="heaven-glass px-4 py-3 text-right">
              <p className="text-[9px] uppercase tracking-[0.32em] text-white/80">Volume</p>
              <p className="mt-1 text-lg font-light text-white">{Math.round(hud.volume * 100)}%</p>
              <div className="heaven-meter heaven-meter-r mt-2">
                <span style={{ width: `${Math.round(hud.volume * 100)}%` }} />
              </div>
            </div>
          </div>
        )}


        {/* pannello attivo */}
        {panel === "sound" && (
          <section className="heaven-glass mt-4 space-y-3 p-4 text-white">
            <h2 className="text-sm font-bold">Suono</h2>
            <div className="flex flex-wrap gap-1.5">
              {INSTRUMENTS.map((it) => (
                <button key={it.id} onClick={() => setInstrument(it.id)} className={chip(instrument === it.id)}>
                  {it.name}
                </button>
              ))}
            </div>
            <button onClick={() => setShowDebug((v) => !v)} className={chip(showDebug)}>
              {showDebug ? <Eye className="mr-1 inline h-3.5 w-3.5" /> : <EyeOff className="mr-1 inline h-3.5 w-3.5" />}
              Costellazione mani
            </button>

          </section>
        )}

        {panel === "fx" && (
          <section className="heaven-glass mt-4 space-y-3 p-4 text-white">
            <h2 className="text-sm font-bold">Effetti</h2>
            {(
              [
                ["Riverbero", reverb, setReverb, 0, 100, 1, "%"],
                ["Delay mix", delayMix, setDelayMix, 0, 100, 1, "%"],
                ["Delay feedback", delayFeedback, setDelayFeedback, 0, 90, 1, "%"],
                ["Risonanza filtro", resonance, setResonance, 0.5, 18, 0.5, ""],
                ["Cutoff massimo", cutMax, setCutMax, 800, 14000, 100, " Hz"],
              ] as const
            ).map(([label, value, set, min, max, step, unit]) => (
              <label key={label} className="block text-[11px] font-semibold text-slate-600">
                {label}: <span className="text-slate-900">{value}{unit}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={value}
                  onChange={(e) => set(Number(e.target.value))}
                  className="mt-1 w-full accent-sky-700"
                />
              </label>
            ))}
            <p className="text-[11px] text-slate-500">
              Il low pass segue l&apos;altezza del Lato A: mano in basso = suono scuro, mano in alto = cutoff
              massimo.
            </p>
          </section>
        )}

        {panel === "scale" && (
          <section className="heaven-glass mt-4 space-y-3 p-4 text-white">
            <h2 className="text-sm font-bold">Tonalità e scala</h2>
            <div className="flex flex-wrap gap-1.5">
              {KEYS.map((n, i) => (
                <button key={n} onClick={() => setRootPc(i)} className={chip(rootPc === i)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)} className={chip(mode === m.id)}>
                  {m.name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Tonica e scala restano bloccate: le mani scelgono solo il grado (1–7).
            </p>
          </section>
        )}


        {panel === "loop" && (
          <section className="heaven-glass mt-4 space-y-3 p-4 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Loop pedal</h2>
              <span className="text-[11px] font-semibold text-slate-500">
                {loop.countIn ? "Preconteggio…" : loop.recording ? "REC" : loop.playing ? "Play" : "Stop"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                BPM
                <input
                  type="range"
                  min={60}
                  max={180}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="w-28"
                />
                <span className="w-8 text-slate-900">{bpm}</span>
              </label>
              <div className="flex gap-1.5">
                {[1, 2, 4].map((b) => (
                  <button key={b} onClick={() => setBars(b)} className={chip(bars === b)}>
                    {b} {b === 1 ? "battuta" : "battute"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => getLooper().record()}
                className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-[12px] font-bold text-white"
              >
                <Circle className="h-3.5 w-3.5 fill-current" /> Rec traccia {loop.selected + 1}
              </button>
              <button
                onClick={() => getLooper().toggle()}
                className="flex items-center gap-1.5 rounded-full bg-sky-700 px-4 py-2 text-[12px] font-bold text-white"
              >
                {loop.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {loop.playing ? "Pausa" : "Play"}
              </button>
              <button
                onClick={() => getLooper().clearAll()}
                className="flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 text-[12px] font-semibold text-slate-700"
              >
                <Trash2 className="h-4 w-4" /> Svuota tutto
              </button>
            </div>

            <div className="space-y-2">
              {loop.tracks.map((t: LoopTrack) => (
                <div
                  key={t.id}
                  className={`rounded-xl border p-2 ${
                    loop.selected === t.id ? "border-sky-700 bg-sky-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => getLooper().select(t.id)}
                      className="rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold text-white"
                    >
                      {t.id + 1}
                    </button>
                    <button onClick={() => getLooper().toggleMute(t.id)} className={chip(t.mute)}>
                      M
                    </button>
                    <button onClick={() => getLooper().toggleSolo(t.id)} className={chip(t.solo)}>
                      S
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={t.volume}
                      onChange={(e) => getLooper().setVolume(t.id, Number(e.target.value))}
                      className="ml-1 w-20"
                    />
                    <button
                      onClick={() => getLooper().clear(t.id)}
                      className="ml-auto text-slate-500"
                      aria-label={`Svuota traccia ${t.id + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-[2px]">
                    {Array.from({ length: bars * STEPS_PER_BAR }, (_, s) => {
                      const ev = t.events.find((e) => e.step === s);
                      return (
                        <button
                          key={s}
                          onClick={() => ev && getLooper().toggleCell(t.id, s)}
                          className={`h-6 flex-1 rounded-[3px] ${
                            ev
                              ? ev.muted
                                ? "bg-slate-300"
                                : "bg-sky-600"
                              : s % 4 === 0
                                ? "bg-slate-200"
                                : "bg-slate-100"
                          } ${loop.step === s && loop.playing ? "ring-2 ring-rose-500" : ""}`}
                          aria-label={`Step ${s + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Spazio play/pausa · 1–4 traccia · M mute · S solo · Canc svuota · Shift+Canc tutto
            </p>
          </section>
        )}

        {panel === "help" && (
          <section className="heaven-glass mt-4 space-y-2 p-4 text-white">
            <h2 className="text-sm font-bold">Guida rapida</h2>
            <ol className="space-y-1.5 text-[12px] text-slate-700">
              {STEPS.map((s, i) => (
                <li key={i}>
                  <b>{i + 1}. {s.t}</b> — {s.d}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {/* barra inferiore */}
      <nav className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
        <div className="heaven-glass mx-auto flex max-w-md items-center justify-between px-4 py-2">
          {(
            [
              ["sound", "Sound", Settings2],
              ["scale", "Scale", Music2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setPanel((p) => (p === id ? null : id))}
              className={`heaven-nav ${panel === id ? "heaven-nav-on" : ""}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}

          <button
            onClick={running ? stop : start}
            aria-label={running ? "Stop" : "Play"}
            className={`heaven-play ${running ? "heaven-play-on" : ""}`}
          >
            {running ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>

          {(
            [
              ["loop", "Loop", Repeat],
              ["fx", "FX", Sliders],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setPanel((p) => (p === id ? null : id))}
              className={`heaven-nav ${panel === id ? "heaven-nav-on" : ""}`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>


      {/* onboarding */}
      {showOnboard && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/60 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-[12px] font-bold tracking-tight text-slate-900">
              STEPH EVO&apos;S HEAVEN SYNTH
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-sky-700">
              Passo {onboard + 1} di {STEPS.length}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{STEPS[onboard]!.t}</h3>
            <div className="mt-3 rounded-xl bg-sky-50 p-2 text-sky-700">
              <TutorialArt id={STEPS[onboard]!.a} />
            </div>
            <p className="mt-2 text-sm text-slate-700">{STEPS[onboard]!.d}</p>
            <div className="mt-4 flex justify-between gap-2">
              <button
                onClick={() => {
                  localStorage.setItem(ONBOARD_KEY, "1");
                  setShowOnboard(false);
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-[12px] font-semibold text-slate-700"
              >
                Salta
              </button>
              <button
                onClick={() => {
                  if (onboard < STEPS.length - 1) setOnboard(onboard + 1);
                  else {
                    localStorage.setItem(ONBOARD_KEY, "1");
                    setShowOnboard(false);
                  }
                }}
                className="rounded-full bg-sky-700 px-5 py-2 text-[12px] font-bold text-white"
              >
                {onboard < STEPS.length - 1 ? "Avanti" : "Inizia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
