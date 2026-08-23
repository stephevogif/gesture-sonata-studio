import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Circle,
  Eye,
  EyeOff,
  HelpCircle,
  Layers,
  Music2,
  Pause,
  Play,
  Radio,
  Repeat,
  Settings2,
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
  modeSteps,
  degreeSemitones,
  ROMAN,
  scaleNoteNames,
  VOICINGS,
  type Chord,
  type ModeId,
  type Tonality,
  type VoicingId,
} from "@/lib/theory";
import {
  Debouncer,
  DEFAULT_DEGREE_RULES,
  gestureToDegree,
  heightToGain,
  Smoother,
  tiltToCutoff,
  TonalitySwitch,
  VOICING_BY_FINGERS,
  type HandFrame,
} from "@/lib/gestures";
import { Looper, STEPS_PER_BAR, emptyTracks, type LoopTrack } from "@/lib/looper";
import { useHandTracking, type TrackingFrame } from "@/hooks/useHandTracking";
import TutorialArt from "@/components/TutorialArt";

type PlayMode = "chords" | "notes" | "theremin";
type PanelId = null | "sound" | "scale" | "loop" | "help";

type Hud = {
  left: { degree: number | null; chord: string; gesture: string } | null;
  right: { voicing: VoicingId; volume: number; filter: number } | null;
  fps: number;
};

const ONBOARD_KEY = "sky-studio-onboarded";

const STEPS = [
  { a: "camera" as const, t: "Fotocamera e tracciamento", d: "Concedi l'accesso alla fotocamera: il video non viene mostrato, vedi solo le mani luminose." },
  { a: "fingers" as const, t: "Lato A = gradi della scala", d: "1–5 dita scelgono i gradi I–V. Indice + mignolo = VI, con il pollice = VII." },
  { a: "tilt" as const, t: "Inclinazione Lato A", d: "Ruota il polso per passare da maggiore a minore (con zona neutra anti-tremolio)." },
  { a: "height" as const, t: "Lato B = espressione", d: "Altezza = volume, dita = rivolto/settima/voicing, inclinazione = filtro." },
  { a: "settings" as const, t: "Personalizza", d: "Tonalità, scala, strumento e modalità nel pannello Impostazioni." },
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

  const degreeDeb = useRef(new Debouncer<number | null>(120));
  const voicingDeb = useRef(new Debouncer<number>(120));
  const tonalitySw = useRef(new TonalitySwitch(0.3));
  const tiltSm = useRef(new Smoother(0.12));
  const volSm = useRef(new Smoother(0.16));
  const pitchSm = useRef(new Smoother(0.2));

  // ————— impostazioni —————
  const [playMode, setPlayMode] = useState<PlayMode>("chords");
  const [rootPc, setRootPc] = useState(9);
  const [mode, setMode] = useState<ModeId>("major");
  const [tonalityLock, setTonalityLock] = useState<Tonality>("auto");
  const [instrument, setInstrument] = useState<InstrumentId>("pads");
  const [showDebug, setShowDebug] = useState(true);
  const [quantize, setQuantize] = useState(true);
  const [panel, setPanel] = useState<PanelId>(null);
  const [hud, setHud] = useState<Hud>({ left: null, right: null, fps: 0 });
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

  const cfg = useRef({ playMode, rootPc, mode, tonalityLock, instrument, showDebug, quantize });
  useEffect(() => {
    cfg.current = { playMode, rootPc, mode, tonalityLock, instrument, showDebug, quantize };
    engineRef.current?.setInstrument(instrument);
  }, [playMode, rootPc, mode, tonalityLock, instrument, showDebug, quantize]);

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
    (ctx: CanvasRenderingContext2D, w: number, h: number, glow: number, fade: number, dt: number) => {
      // gradiente cielo (cache: ricreato solo al cambio dimensione)
      const cache = skyCache.current;
      if (cache.w !== w || cache.h !== h || !cache.grad) {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, "#1e63c8");
        sky.addColorStop(0.35, "#4f92e0");
        sky.addColorStop(0.7, "#a8cef4");
        sky.addColorStop(1, "#eaf5ff");
        cache.grad = sky;
        cache.w = w;
        cache.h = h;
        cloudsRef.current = [];
      }
      ctx.fillStyle = cache.grad!;
      ctx.fillRect(0, 0, w, h);

      // sprite riusabili (nessun gradiente creato per frame)
      if (!cloudSprite.current) cloudSprite.current = makeBlobSprite(256, "255,255,255");
      if (!sunSprite.current) sunSprite.current = makeSunSprite(256);

      if (cloudsRef.current.length === 0) {
        cloudsRef.current = Array.from({ length: 14 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: h * (0.12 + Math.random() * 0.3),
          v: 6 + Math.random() * 22,
          a: 0.3 + Math.random() * 0.45,
        }));
      }

      if (fade <= 0.004) return;

      const t = performance.now() / 1000;
      const sun = sunSprite.current!;
      const cloud = cloudSprite.current!;

      // ————— sole: tre cerchi concentrici con respiro sfasato —————
      const s = sunRef.current;
      s.p += (0.012 + glow * 0.05) * dt;
      if (s.p > 1.3) {
        s.p = -0.3;
        s.y = 0.16 + Math.random() * 0.34;
      }
      const sx = s.p * w;
      const sy = s.y * h;
      const base = Math.min(w, h) * 0.14;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const phase = i * 0.7;
        const osc = Math.sin(t * 1.1 + phase);
        const r = base * (1 + i * 0.95) * (1 + osc * (0.06 + glow * 0.18));
        const a = [0.85, 0.4, 0.2][i]! * fade * (0.55 + glow * 0.7) * (0.8 + osc * 0.2);
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(sun, sx - r, sy - r, r * 2, r * 2);
      }
      ctx.restore();

      // ————— nuvole —————
      ctx.save();
      for (const c of cloudsRef.current) {
        c.x += c.v * (1 + glow * 1.4) * dt;
        if (c.x - c.r > w) {
          c.x = -c.r;
          c.y = Math.random() * h;
          c.r = h * (0.12 + Math.random() * 0.3);
          c.v = 6 + Math.random() * 22;
          c.a = 0.3 + Math.random() * 0.45;
        }
        ctx.globalAlpha = Math.min(1, (c.a + glow * 0.25) * fade);
        ctx.drawImage(cloud, c.x - c.r, c.y - c.r * 0.7, c.r * 2, c.r * 1.4);
      }
      ctx.restore();
    },
    [],
  );



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
      ctx.shadowBlur = 26;
      ctx.shadowColor = hand.handedness === "left" ? "rgba(37,99,235,0.65)" : "rgba(13,148,136,0.6)";
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineCap = "round";
      ctx.lineWidth = 10;
      ctx.beginPath();
      for (const [a, b] of links) {
        ctx.moveTo(px(a!), py(a!));
        ctx.lineTo(px(b!), py(b!));
      }
      ctx.stroke();
      ctx.shadowBlur = 10;
      ctx.strokeStyle = hand.handedness === "left" ? "rgba(30,64,175,0.95)" : "rgba(15,118,110,0.95)";
      ctx.lineWidth = 3;
      ctx.stroke();
      if (cfg.current.showDebug) {
        for (let i = 0; i < 21; i++) {
          ctx.beginPath();
          ctx.fillStyle = "rgba(255,255,255,0.98)";
          ctx.shadowBlur = 14;
          ctx.arc(px(i), py(i), i % 4 === 0 ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
        }
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
      const { playMode: pm, rootPc: root, mode: md, tonalityLock: lock } = cfg.current;

      // ————— espressione (Lato B) —————
      const volume = right ? volSm.current.push(heightToGain(right.height)) : volSm.current.push(0);
      const tiltR = right ? tiltSm.current.push(right.tilt) : tiltSm.current.value;
      const cutoff = tiltToCutoff(tiltR);
      engine.setEq("lowpass", cutoff);
      const bright = Math.max(0, Math.min(1, 0.3 + tiltR * 0.5 + 0.3));

      const voicingIdx = right
        ? (voicingDeb.current.push(Math.max(1, Math.min(5, right.count))) ?? 1) - 1
        : 0;
      const voicing = (VOICING_BY_FINGERS[voicingIdx] ?? "triad") as VoicingId;

      let chord: Chord | null = null;

      if (pm === "theremin") {
        if (left) {
          const steps = modeSteps(md);
          const raw = 48 + left.height * 30;
          const midi = cfg.current.quantize
            ? (() => {
                const deg = Math.round((raw - 48 - root) / 12 * steps.length);
                return 48 + root + degreeSemitones(steps, deg);
              })()
            : pitchSm.current.push(raw);
          const g = right ? volume : 0.6;
          applyNotes([Math.round(midi * 100) / 100], Math.max(0.05, g), bright);
          currentRef.current.chord = {
            degree: 0,
            rootMidi: midi,
            rootName: midiName(Math.round(midi)),
            quality: "major",
            seventh: false,
            notes: [Math.round(midi)],
            label: midiName(Math.round(midi)),
          };
        } else {
          releaseAll();
        }
      } else if (left) {
        const degree = degreeDeb.current.push(
          gestureToDegree(left.fingers, left.count, DEFAULT_DEGREE_RULES),
        );
        if (degree === null || degree === undefined) {
          releaseAll();
        } else {
          const tonality: Tonality =
            lock === "auto" ? tonalitySw.current.push(tiltSm.current.value || left.tilt) : lock;
          chord = buildChord({
            rootPc: root,
            mode: md,
            degree,
            tonality,
            voicing: pm === "notes" ? "triad" : voicing,
            previous: prevNotesRef.current,
          });
          const notes = pm === "notes" ? [chord.notes[0]!] : chord.notes;
          const gain = right ? Math.max(0.08, volume) : 0.6;
          applyNotes(notes, gain, bright);
          prevNotesRef.current = notes;
          currentRef.current.chord = { ...chord, notes };
        }
      } else {
        releaseAll();
      }

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

      for (const hand of hands) drawHand(ctx, hand, w, h);

      // ————— HUD (throttle) —————
      const now = performance.now();
      if (now - hudTick.current > 110) {
        hudTick.current = now;
        const cur = currentRef.current.chord;
        setHud({
          left: left
            ? {
                degree: cur && pm !== "theremin" ? cur.degree : null,
                chord: cur ? cur.label : "—",
                gesture: `${left.count} dita`,
              }
            : null,
          right: right ? { voicing, volume, filter: cutoff } : null,
          fps,
        });
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
    engine.setReverb(0.45);
    engine.setTempo(bpm);
    await startCam();
  }, [bpm, startCam]);

  const stop = useCallback(() => {
    stopCam();
    releaseAll();
    engineRef.current?.allOff();
    looperRef.current?.pause();
    setHud({ left: null, right: null, fps: 0 });
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

  const activeDegree = hud.left?.degree ?? null;

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
      active
        ? "border-sky-700 bg-sky-700 text-white shadow-sm"
        : "border-slate-300 bg-white text-slate-700 hover:border-sky-500"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">
        {/* header */}
        <header className="flex items-center justify-between gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Sky Synth
          </Link>
          <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            STEPH EVO&apos;S <span className="text-sky-700">HEAVEN SYNTH</span>
          </h1>
          <button
            onClick={running ? stop : start}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold text-white shadow ${
              running ? "bg-rose-600" : "bg-sky-700"
            }`}
          >
            {running ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {running ? "Stop" : "Play"}
          </button>
        </header>

        {/* modalità */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-slate-300 bg-white p-1">
          {(
            [
              ["chords", "Accordi", Layers],
              ["notes", "Note", Music2],
              ["theremin", "Theremin", Radio],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                releaseAll();
                setPlayMode(id);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[12px] font-semibold transition ${
                playMode === id ? "bg-sky-700 text-white" : "text-slate-600"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* striscia della scala */}
        <div className="mt-3 flex justify-between gap-1">
          {noteNames.map((n, i) => (
            <div
              key={i}
              className={`flex flex-1 flex-col items-center rounded-xl border py-1.5 ${
                activeDegree === i % 7 && (i < 7 || activeDegree === 0)
                  ? "border-sky-700 bg-sky-700 text-white"
                  : "border-slate-300 bg-white text-slate-800"
              }`}
            >
              <span className="text-[13px] font-bold leading-none">{n}</span>
              <span className="mt-1 text-[9px] font-semibold tracking-widest opacity-70">
                {i === 7 ? "I'" : ROMAN[i]}
              </span>
            </div>
          ))}
        </div>

        {/* palco */}
        <div className="mt-3 overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-sm">
          <div className="relative aspect-[3/4] w-full bg-slate-100 sm:aspect-[4/3]">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

            {running && (
              <>
                <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-800 shadow">
                  <div className="text-[9px] uppercase tracking-widest text-sky-800">Lato A</div>
                  {hud.left ? (
                    <>
                      <div>
                        Grado: <b>{hud.left.degree !== null ? ROMAN[hud.left.degree] : "—"}</b>
                      </div>
                      <div>
                        Accordo: <b>{hud.left.chord}</b>
                      </div>
                      <div className="text-slate-500">{hud.left.gesture}</div>
                    </>
                  ) : (
                    <div className="text-slate-500">nessuna mano</div>
                  )}
                </div>
                <div className="pointer-events-none absolute right-3 top-3 rounded-xl bg-white/90 px-3 py-2 text-right text-[11px] font-semibold text-slate-800 shadow">
                  <div className="text-[9px] uppercase tracking-widest text-teal-800">Lato B</div>
                  {hud.right ? (
                    <>
                      <div>
                        Voicing: <b>{VOICINGS.find((v) => v.id === hud.right!.voicing)?.name}</b>
                      </div>
                      <div>Volume: {Math.round(hud.right.volume * 100)}%</div>
                      <div>Filtro: {(hud.right.filter / 1000).toFixed(1)} kHz</div>
                    </>
                  ) : (
                    <div className="text-slate-500">nessuna mano</div>
                  )}
                </div>
                <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] font-semibold text-slate-500">
                  {Math.round(hud.fps)} fps
                </div>
              </>
            )}

            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-sm text-sm font-medium text-slate-700">
                  {status ||
                    "Lato A sceglie il grado della scala (dita) e maggiore/minore (inclinazione). Lato B controlla volume, voicing e filtro."}
                </p>
                <button
                  onClick={start}
                  className="rounded-full bg-sky-700 px-6 py-3 text-sm font-bold text-white shadow"
                >
                  Inizia a suonare
                </button>
              </div>
            )}
          </div>
        </div>

        {/* pannello attivo */}
        {panel === "sound" && (
          <section className="mt-3 space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
            <h2 className="text-sm font-bold">Suono</h2>
            <div className="flex flex-wrap gap-1.5">
              {INSTRUMENTS.map((it) => (
                <button key={it.id} onClick={() => setInstrument(it.id)} className={chip(instrument === it.id)}>
                  {it.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setShowDebug((v) => !v)} className={chip(showDebug)}>
                {showDebug ? <Eye className="mr-1 inline h-3.5 w-3.5" /> : <EyeOff className="mr-1 inline h-3.5 w-3.5" />}
                Overlay debug
              </button>
              <button onClick={() => setQuantize((v) => !v)} className={chip(quantize)}>
                Theremin in scala
              </button>
            </div>
          </section>
        )}

        {panel === "scale" && (
          <section className="mt-3 space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
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
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Tonalità Lato A
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["auto", "Auto dal polso"],
                    ["major", "Blocca maggiore"],
                    ["minor", "Blocca minore"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} onClick={() => setTonalityLock(id)} className={chip(tonalityLock === id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Gesture → grado
              </p>
              <ul className="grid grid-cols-2 gap-1 text-[11px] text-slate-700">
                {DEFAULT_DEGREE_RULES.slice()
                  .sort((a, b) => a.degree - b.degree)
                  .map((r) => (
                    <li key={r.id} className="rounded-lg bg-slate-100 px-2 py-1">
                      <b>{ROMAN[r.degree]}</b> · {r.label}
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        )}

        {panel === "loop" && (
          <section className="mt-3 space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
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
          <section className="mt-3 space-y-2 rounded-2xl border border-slate-300 bg-white p-4">
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
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-300 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-2">
          {(
            [
              ["sound", "Suono", Settings2],
              ["scale", "Scala", Music2],
              ["loop", "Loop", Repeat],
              ["help", "Guida", HelpCircle],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setPanel((p) => (p === id ? null : id))}
              className={`flex min-w-16 flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold ${
                panel === id ? "bg-sky-700 text-white" : "text-slate-600"
              }`}
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
