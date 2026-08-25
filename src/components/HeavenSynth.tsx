import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  HelpCircle,
  ListMusic,
  Mic,
  Music2,
  Play,
  RefreshCw,
  Repeat,
  Sliders,
  Square,
} from "lucide-react";
import { GestureSynthEngine, INSTRUMENTS, INSTRUMENT_SHIFT, type InstrumentId } from "@/lib/synth";
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
import { useHandTracking, type TrackingFrame } from "@/hooks/useHandTracking";
import { useSongMode } from "@/hooks/useSongMode";
import SongModeHud from "@/components/songs/SongModeHud";
import { updateSongSession } from "@/core/songs/session";
import TutorialArt from "@/components/TutorialArt";
import FloatingWindow from "@/components/ui/FloatingWindow";
import SoundConstellation from "@/components/sound/SoundConstellation";
import { defaultMix, toMixSpec, type MixState } from "@/core/sound/mix";
import { detectKey } from "@/lib/keyDetect";

type PanelId = null | "sound" | "scale" | "arp" | "help";

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

/** particle budget: keeps the canvas smooth on phones */
const MAX_PARTICLES = 200;

const STEPS = [
  {
    a: "camera" as const,
    t: "Fotocamera e tracciamento",
    d: "Concedi l'accesso alla fotocamera: vedrai te stesso nel cielo, con le mani illuminate come costellazioni.",
  },
  {
    a: "fingers" as const,
    t: "7 Heavens",
    d: "Le dita totali delle due mani (1–7) scelgono l'accordo I–VII della scala scelta.",
  },
  {
    a: "height" as const,
    t: "Lato A = filtro",
    d: "Alza o abbassa la mano A: apre e chiude il low pass risonante degli accordi.",
  },
  {
    a: "height" as const,
    t: "Volume",
    d: "Il volume parte fisso al 100%: mostra 10 dita per passare al controllo con la mano B (altezza) e 10 dita di nuovo per tornare fisso.",
  },
  {
    a: "settings" as const,
    t: "Suono ed effetti",
    d: "Strumento nel pannello Suono; riverbero, delay, risonanza e cutoff nel pannello Effetti.",
  },
  {
    a: "loop" as const,
    t: "Arpeggiatore",
    d: "Chiudi e riapri velocemente entrambe le mani per accendere o spegnere l'arpeggiatore (tasto A).",
  },
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
  const skyCache = useRef<{ w: number; h: number; grad: CanvasGradient | null }>({
    w: 0,
    h: 0,
    grad: null,
  });
  const cloudSprite = useRef<HTMLCanvasElement | null>(null);
  const sunSprite = useRef<HTMLCanvasElement | null>(null);
  const fadeRef = useRef(0);
  const musicRef = useRef(0);
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }[]
  >([]);
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
  /** Sound Constellation: fino a 4 strumenti + FX per strumento e sul master */
  const [mix, setMix] = useState<MixState>(() => defaultMix("pads"));
  const instrument: InstrumentId = mix.instruments[0]?.instrument ?? "pads";
  const [showDebug, setShowDebug] = useState(true);
  const [panel, setPanel] = useState<PanelId>(null);
  /** eco mode: while a floating window is open the canvas drops its extras */
  const panelOpenRef = useRef(false);
  panelOpenRef.current = panel !== null;
  const [hud, setHud] = useState<Hud>({ volume: 0, filter: 8000, heavens: null, fps: 0 });

  // ————— SONG MODE (Heaven Songs) —————
  const songMode = useSongMode();
  const songId = songMode.song?.id ?? null;
  const songRootPc = songMode.rootPc;
  const songScale = songMode.song?.scale ?? null;
  const songBpm = songMode.song?.bpm ?? null;
  /** la song imposta automaticamente tonica, scala e tempo: nessun setup manuale */
  useEffect(() => {
    if (!songId || songRootPc == null || !songScale) return;
    setRootPc(songRootPc);
    setMode(songScale);
    if (songBpm) setBpm(songBpm);
  }, [songId, songRootPc, songScale, songBpm]);

  // ————— filtro gestuale + legato —————
  const [cutMax, setCutMax] = useState(8000);
  const [resonance, setResonance] = useState(6);
  /** legato: tempo di scivolamento fra un accordo e l'altro, in ms */
  const [legato, setLegatoMs] = useState(90);

  const [onboard, setOnboard] = useState(0);
  const [showOnboard, setShowOnboard] = useState(false);

  // ————— arpeggiatore —————
  const [bpm, setBpm] = useState(100);
  const [arpOn, setArpOn] = useState(false);
  const [arpDiv, setArpDiv] = useState(2);
  const [arpMode, setArpMode] = useState<"up" | "down" | "updown" | "octaves" | "random">("up");
  const [arpGate, setArpGate] = useState(0.7);
  const arpOnRef = useRef(false);
  const holdRef = useRef(false);
  const heldDegreeRef = useRef<number | null>(null);
  const lastStableRef = useRef<number | null>(null);

  // ————— volume: fisso al 100% oppure controllato dalla mano (gesto 10 dita) —————
  const [volFollow, setVolFollow] = useState(false);
  const volFollowRef = useRef(false);
  volFollowRef.current = volFollow;

  // gesto "doppio pugno": chiudi e riapri entrambe le mani per accendere/spegnere l'arp
  const fistAtRef = useRef(0);
  const armedRef = useRef(false);
  const lastArpGestureRef = useRef(0);

  const cfg = useRef({ rootPc, mode, instrument, showDebug, cutMax });
  useEffect(() => {
    cfg.current = { rootPc, mode, instrument, showDebug, cutMax };
    engineRef.current?.setInstrument(instrument);
  }, [rootPc, mode, instrument, showDebug, cutMax]);

  useEffect(() => {
    engineRef.current?.setResonance(resonance);
  }, [resonance]);
  /** ogni modifica alla costellazione riconcilia canali e catene FX */
  useEffect(() => {
    engineRef.current?.applyMix(toMixSpec(mix));
  }, [mix]);
  useEffect(() => {
    engineRef.current?.setLegato(legato / 1000);
  }, [legato]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(ONBOARD_KEY)) setShowOnboard(true);
  }, []);

  const noteNames = useMemo(() => scaleNoteNames(rootPc, mode), [rootPc, mode]);

  /* ————— ascolto microfono: tonica + scala automatiche ————— */
  const [listening, setListening] = useState(false);
  const [listenProgress, setListenProgress] = useState(0);
  const [listenDuration, setListenDuration] = useState(16000);
  const [listenMsg, setListenMsg] = useState<string | null>(null);
  const listenAbortRef = useRef<AbortController | null>(null);

  const runListening = useCallback(async (durationMs: number) => {
    listenAbortRef.current?.abort();
    const ac = new AbortController();
    listenAbortRef.current = ac;
    setListening(true);
    setListenProgress(0);
    setListenMsg(null);
    try {
      const res = await detectKey({
        durationMs,
        signal: ac.signal,
        onProgress: ({ progress }) => setListenProgress(progress),
      });
      const md: ModeId =
        res.scaleId === "dorian" ? "dorian" : res.mode === "minor" ? "minor" : "major";
      setRootPc(res.rootPc);
      setMode(md);
      const name = `${KEYS[res.rootPc]} ${MODES.find((m) => m.id === md)?.name ?? ""}`;
      setListenMsg(
        res.confidence > 0.3
          ? `Applicato: ${name}`
          : `Applicato: ${name} — confidenza bassa, riprova con più suono`,
      );
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") setListenMsg("Ascolto interrotto.");
      else if (err.name === "NotAllowedError") setListenMsg("Permesso microfono negato.");
      else setListenMsg(err.message || "Non è stato possibile ascoltare.");
    } finally {
      setListening(false);
      setListenProgress(0);
    }
  }, []);

  const toggleListen = useCallback(() => {
    if (listening) listenAbortRef.current?.abort();
    else void runListening(listenDuration);
  }, [listening, runListening, listenDuration]);

  useEffect(() => () => listenAbortRef.current?.abort(), []);

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
    activeIdsRef.current.filter((id) => !ids.includes(id)).forEach((id) => e.noteOff(id, true));
    notes.forEach((m, i) => {
      const amp = gain * (i === 0 ? 1 : 0.7);
      e.noteOn(ids[i]!, midiToFreq(m + shift), Math.max(0.02, amp), bright, inst);
    });
    activeIdsRef.current = ids;
  }, []);

  /* ————— arpeggiatore ————— */

  useEffect(() => {
    arpOnRef.current = arpOn;
    if (!arpOn) return;
    const interval = (60 / Math.max(40, bpm) / arpDiv) * 1000;
    let i = 0;
    const id = setInterval(() => {
      const e = engineRef.current;
      const c = currentRef.current.chord;
      if (!e || !c || !c.notes.length) return;
      const inst = cfg.current.instrument;
      const shift = INSTRUMENT_SHIFT[inst] ?? 0;
      const base = c.notes;
      const seq =
        arpMode === "down"
          ? [...base].reverse()
          : arpMode === "updown"
            ? [...base, ...[...base].reverse().slice(1, -1)]
            : arpMode === "octaves"
              ? [...base, ...base.map((n) => n + 12)]
              : base;
      const m =
        arpMode === "random"
          ? (base[Math.floor(Math.random() * base.length)] ?? base[0]!)
          : (seq[i % seq.length] ?? base[0]!);
      i += 1;
      e.pluck(
        "arp",
        midiToFreq(m + shift),
        Math.max(0.1, currentRef.current.volume),
        0.6,
        inst,
        (interval / 1000) * arpGate,
      );
    }, interval);
    return () => clearInterval(id);
  }, [arpOn, bpm, arpDiv, arpMode, arpGate]);

  useEffect(() => {
    engineRef.current?.setTempo(bpm);
  }, [bpm]);

  /* ————— rendering ————— */

  const drawSky = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      glow: number,
      fade: number,
      dt: number,
      music: number,
    ) => {
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

      // ————— sole al centro: tre cerchi concentrici con respiro sfasato —————
      {
        const sx = w * 0.5;
        const sy = h * 0.44;
        const base = Math.min(w, h) * 0.11;
        const wake = 0.14 + music * 0.86; // presenza minima anche in silenzio
        const pulse = 0.9 + Math.sin(t * 1.6) * 0.1 * music;
        for (let i = 0; i < 3; i++) {
          const osc = Math.sin(t * (0.9 + music * 0.5) - i * 0.8);
          const r = base * (1 + i * 0.95) * (1 + osc * (0.04 + glow * 0.2 + music * 0.06)) * pulse;
          const a = [0.55, 0.26, 0.13][i]! * wake * (0.5 + glow * 0.7) * (0.85 + osc * 0.15);
          ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(sun, sx - r, sy - r, r * 2, r * 2);
        }
        // raggi che ruotano lentamente solo mentre suona
        if (music > 0.02) {
          const rays = 12;
          const rot = t * 0.16;
          const inner = base * 1.5;
          const outer = base * (2.1 + Math.sin(t * 1.2) * 0.16 + glow * 0.5);
          ctx.globalAlpha = Math.min(0.5, music * (0.16 + glow * 0.3));
          ctx.strokeStyle = "rgba(255,236,186,1)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let i = 0; i < rays; i++) {
            const ang = rot + (i / rays) * Math.PI * 2;
            const c1 = Math.cos(ang);
            const s1 = Math.sin(ang);
            const len = outer * (i % 2 ? 0.78 : 1);
            ctx.moveTo(sx + c1 * inner, sy + s1 * inner);
            ctx.lineTo(sx + c1 * len, sy + s1 * len);
          }
          ctx.stroke();
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
    if (arr.length > MAX_PARTICLES) return;
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

  /** pre-rendered glow sprite: `shadowBlur` per particle is far too costly */
  const sparkSprite = useRef<HTMLCanvasElement | null>(null);
  const getSpark = useCallback(() => {
    if (sparkSprite.current) return sparkSprite.current;
    const size = 24;
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const c = cv.getContext("2d");
    if (c) {
      const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255,248,220,1)");
      g.addColorStop(0.35, "rgba(255,222,155,0.6)");
      g.addColorStop(1, "rgba(255,205,130,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, size, size);
    }
    sparkSprite.current = cv;
    return cv;
  }, []);

  const drawParticles = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number) => {
      const arr = particlesRef.current;
      if (!arr.length) return;
      const spark = getSpark();
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
        ctx.globalAlpha = Math.max(0, p.life) * 0.85;
        const d = p.r * 6;
        ctx.drawImage(spark, p.x - d / 2, p.y - d / 2, d, d);
      }
      ctx.restore();
    },
    [getSpark],
  );


  /* ————— aura luminosa sulle mani mentre suonano ————— */
  const drawHandGlow = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      hand: HandFrame,
      w: number,
      h: number,
      music: number,
      volume: number,
    ) => {
      if (music <= 0.02) return;
      const sprite = sunSprite.current;
      if (!sprite) return;
      const lm = hand.landmarks;
      const t = performance.now() / 1000;
      const breath = 0.82 + Math.sin(t * 3.1) * 0.18;
      const power = music * (0.45 + Math.min(1, volume) * 0.55);
      const scale = Math.min(w, h);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // alone ampio attorno al palmo
      const palm = lm[9] ?? lm[0]!;
      const cx = (1 - palm.x) * w;
      const cy = palm.y * h;
      const halo = scale * (0.16 + power * 0.1) * breath;
      ctx.globalAlpha = Math.min(0.65, power * 0.5 * breath);
      ctx.drawImage(sprite, cx - halo, cy - halo, halo * 2, halo * 2);

      // bagliori pulsanti sui polpastrelli
      const tips = [4, 8, 12, 16, 20];
      for (let k = 0; k < tips.length; k++) {
        const p = lm[tips[k]!];
        if (!p) continue;
        const osc = 0.75 + Math.sin(t * 5.2 - k * 0.9) * 0.25;
        const r = scale * (0.035 + power * 0.028) * osc;
        const x = (1 - p.x) * w;
        const y = p.y * h;
        ctx.globalAlpha = Math.min(0.9, power * 0.85 * osc);
        ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
      }

      // scia dorata lungo lo scheletro: le dita diventano filamenti di luce
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
      ctx.globalAlpha = Math.min(0.8, power * 0.7 * breath);
      ctx.strokeStyle = "rgba(255,244,214,1)";
      ctx.lineWidth = 1.2 + power * 1.8;
      ctx.lineCap = "round";
      ctx.shadowBlur = 18 + power * 22;
      ctx.shadowColor = "rgba(255,214,140,0.95)";
      ctx.beginPath();
      for (const [a, b] of links) {
        const pa = lm[a!];
        const pb = lm[b!];
        if (!pa || !pb) continue;
        ctx.moveTo((1 - pa.x) * w, pa.y * h);
        ctx.lineTo((1 - pb.x) * w, pb.y * h);
      }
      ctx.stroke();
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

      // ————— Lato B (destra): altezza = volume (solo se il controllo mano è attivo) —————
      const handVol = right ? heightToGain(right.height) : 0;
      const volume = volSm.current.push(volFollowRef.current ? handVol : 1);

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

      // gesto arp: entrambe le mani chiuse e subito riaperte
      const nowGesture = performance.now();
      if (left && right) {
        if (lc === 0 && rc === 0) {
          if (!armedRef.current) {
            armedRef.current = true;
            fistAtRef.current = nowGesture;
          }
        } else if (armedRef.current && lc >= 4 && rc >= 4) {
          armedRef.current = false;
          if (
            nowGesture - fistAtRef.current < 900 &&
            nowGesture - lastArpGestureRef.current > 1200
          ) {
            lastArpGestureRef.current = nowGesture;
            setArpOn((v) => !v);
          }
        } else if (armedRef.current && nowGesture - fistAtRef.current > 1200) {
          armedRef.current = false;
        }
      } else {
        armedRef.current = false;
      }

      const stable = heavensDeb.current.push(total >= 1 && total <= 10 ? total : null);
      if (stable !== lastStableRef.current) {
        lastStableRef.current = stable;
        if (stable === 10) setVolFollow((v) => !v);
      }

      let deg: number | null = null;
      if (hands.length && stable && stable <= 7) {
        deg = stable - 1;
        chord = buildChord({
          rootPc: root,
          mode: md,
          degree: deg,
          tonality: "auto",
          voicing: "triad",
          previous: prevNotesRef.current,
        });
        if (arpOnRef.current) releaseAll();
        else applyNotes(chord.notes, Math.max(0.06, volume), bright);
        prevNotesRef.current = chord.notes;
        currentRef.current.chord = chord;
        heldDegreeRef.current = deg;
      } else if (holdRef.current) {
        chord = currentRef.current.chord;
        deg = heldDegreeRef.current;
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
      const dt = lastFrameRef.current
        ? Math.min(0.05, (nowMs - lastFrameRef.current) / 1000)
        : 0.016;
      lastFrameRef.current = nowMs;
      const target = hands.length ? Math.max(0.2, volume) : 0;
      const k = 1 - Math.exp(-dt * 4);
      glowRef.current += (target - glowRef.current) * k;
      fadeRef.current +=
        ((hands.length ? 1 : 0) - fadeRef.current) * (1 - Math.exp(-dt * (hands.length ? 3 : 1.6)));
      const sounding = chord ? 1 : 0;
      musicRef.current +=
        (sounding - musicRef.current) * (1 - Math.exp(-dt * (sounding ? 2.6 : 1.1)));
      drawSky(ctx, w, h, glowRef.current, fadeRef.current, dt, musicRef.current);

      const eco = panelOpenRef.current;
      if (chord && !eco) {
        const amt = 0.35 + Math.min(1, volume) * 0.45;
        for (const hand of hands) emitParticles(hand, w, h, amt);
      }
      if (!eco) {
        for (const hand of hands) drawHandGlow(ctx, hand, w, h, musicRef.current, volume);
      }
      drawParticles(ctx, dt);

      if (cfg.current.showDebug) for (const hand of hands) drawHand(ctx, hand, w, h);

      // ————— HUD (throttle) —————
      const now = performance.now();
      if (now - hudTick.current > 110) {
        hudTick.current = now;
        setHud({ volume, filter: cutoff, heavens: heavensHud, fps });
      }
    },
    [applyNotes, drawHand, drawHandGlow, drawSky, drawParticles, emitParticles, releaseAll],
  );

  const {
    videoRef,
    running,
    status,
    error: camError,
    start: startCam,
    stop: stopCam,
  } = useHandTracking(onFrame);

  const start = useCallback(async () => {
    const engine = engineRef.current ?? new GestureSynthEngine();
    engineRef.current = engine;
    // audio e fotocamera partono insieme: avvio più rapido
    const camReady = startCam();
    await engine.start();
    engine.setChord("off");
    engine.setInstrument(cfg.current.instrument);
    engine.setReverb(0);
    engine.setDelay({ mix: 0, sync: false });
    engine.setChorus({ mix: 0 });
    engine.setResonance(resonance);
    engine.setLegato(legato / 1000);
    engine.setTempo(bpm);
    engine.applyMix(toMixSpec(mix));
    await camReady;
  }, [bpm, legato, mix, resonance, startCam]);

  const stop = useCallback(() => {
    stopCam();
    releaseAll();
    engineRef.current?.allOff();
    holdRef.current = false;
    setHud({ volume: 0, filter: 8000, heavens: null, fps: 0 });
  }, [releaseAll, stopCam]);

  useEffect(() => () => stop(), [stop]);

  /* ————— scorciatoie ————— */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key.toLowerCase() === "a") setArpOn((v) => !v);
      else if (e.key.toLowerCase() === "h") holdRef.current = !holdRef.current;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const activeDegree = hud.heavens?.degree ?? null;
  const playing = activeDegree != null;

  /* Song Mode: confronta il grado atteso con quello riconosciuto (manual follow) */
  const observeSong = songMode.observe;
  useEffect(() => {
    observeSong(activeDegree == null ? null : activeDegree + 1);
  }, [activeDegree, observeSong]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
      active
        ? "border-[rgba(255,222,160,0.9)] bg-[rgba(255,238,200,0.28)] text-[#3a2f16] shadow-sm"
        : "border-white/50 bg-white/25 text-[#3f4b62] hover:border-white/80"
    }`;

  const field =
    "mt-1.5 w-full appearance-none rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 text-[13px] font-semibold tracking-normal text-[#2b3855] shadow-sm outline-none transition focus:border-[rgba(255,222,160,0.95)]";

  return (
    <div className="heaven-scene relative min-h-screen overflow-hidden text-[#33405a]">
      {/* strato camera: sfondo vivo di tutta la pagina */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-hidden
          className="absolute h-px w-px opacity-0"
        />
        <div className="heaven-stars absolute inset-0" />
        <div className="heaven-veil absolute inset-0" />

        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />
        <div className="heaven-vignette absolute inset-0" />
      </div>

      {/* gradiente scuro in basso per far risaltare la nav */}
      <div className="heaven-bottom-shade" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 pb-40 pt-5">
        {/* header */}
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <Link to="/" aria-label="Torna alla home" className="heaven-orb-btn">
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
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPanel((p) => (p === "scale" ? null : "scale"))}
            className="heaven-pill"
          >
            {KEYS[rootPc]} · {MODES.find((m) => m.id === mode)?.name.toUpperCase()}
            <span className="ml-2 opacity-70">⌄</span>
          </button>
          <button
            onClick={toggleListen}
            aria-pressed={listening}
            aria-label={listening ? "Ferma il microfono" : "Rileva scala dal microfono"}
            className={`heaven-orb-btn ${listening ? "animate-pulse" : ""}`}
          >
            {listening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        </div>
        {(listening || listenMsg) && (
          <p className="mt-2 text-center text-[11px] font-semibold text-slate-600">
            {listening ? `Ascolto… ${Math.round(listenProgress * 100)}%` : listenMsg}
          </p>
        )}

        {/* Song Mode */}
        {songMode.song && <SongModeHud state={songMode} rootPc={rootPc} mode={mode} />}

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
              <p className="heaven-title mt-1 text-[4.2rem] leading-[0.9]">
                {ROMAN[activeDegree!]}
              </p>
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
              {!running && camError && (
                <p className="mx-auto mt-3 max-w-xs text-[11px] leading-relaxed text-[#ffd9a8]">
                  {camError}
                </p>
              )}
              {!running && (
                <button
                  onClick={start}
                  aria-label={camError ? "Riprova" : "Play"}
                  className="heaven-play heaven-play-breathe mx-auto mt-6"
                >
                  {camError ? (
                    <RefreshCw className="h-7 w-7" />
                  ) : (
                    <Play className="h-7 w-7" />
                  )}
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
                <span
                  style={{
                    width: `${Math.min(100, (hud.filter / Math.max(1000, cutMax)) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="heaven-glass px-4 py-3 text-right">
              <p className="text-[9px] uppercase tracking-[0.32em] text-white/80">
                Volume {volFollow ? "· mano" : "· fisso"}
              </p>
              <p className="mt-1 text-lg font-light text-white">{Math.round(hud.volume * 100)}%</p>
              <div className="heaven-meter heaven-meter-r mt-2">
                <span style={{ width: `${Math.round(hud.volume * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* i pannelli sono floating windows: vedi in fondo al componente */}

        {panel === "sound" && (
          <FloatingWindow
            title="Sound Constellation"
            subtitle={`${mix.instruments.length} ${mix.instruments.length === 1 ? "strumento" : "strumenti"} · trascina per il mix`}
            onClose={() => setPanel(null)}
          >
            <SoundConstellation state={mix} onChange={setMix} />
            <div className="mt-3 space-y-3 border-t border-white/40 pt-3">
              <label className="block text-[11px] font-semibold">
                Legato fra accordi: <b>{legato} ms</b>
                <input
                  type="range"
                  min={0}
                  max={600}
                  step={10}
                  value={legato}
                  onChange={(e) => setLegatoMs(Number(e.target.value))}
                  className="sc-range"
                  aria-label="Velocità legato fra accordi"
                />
              </label>
              <label className="block text-[11px] font-semibold">
                Volume
                <select
                  value={volFollow ? "hand" : "fixed"}
                  onChange={(e) => setVolFollow(e.target.value === "hand")}
                  className="sc-field"
                  aria-label="Modalità volume"
                >
                  <option value="fixed">Fisso 100%</option>
                  <option value="hand">Controllo con la mano</option>
                </select>
              </label>
              <button onClick={() => setShowDebug((v) => !v)} className={chip(showDebug)}>
                {showDebug ? (
                  <Eye className="mr-1 inline h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="mr-1 inline h-3.5 w-3.5" />
                )}
                Costellazione mani
              </button>
              <p className="text-[11px] opacity-70">
                Gesto: 10 dita alternano volume fisso al 100% e controllo con la mano.
              </p>
            </div>
          </FloatingWindow>
        )}

        {panel === "scale" && (
          <FloatingWindow title="Tonalità e scala" onClose={() => setPanel(null)}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Tonica
                  <select
                    value={rootPc}
                    onChange={(e) => setRootPc(Number(e.target.value))}
                    className={field}
                    aria-label="Tonica"
                  >
                    {KEYS.map((n, i) => (
                      <option key={n} value={i}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Scala
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ModeId)}
                    className={field}
                    aria-label="Scala"
                  >
                    {MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="space-y-2 border-t border-white/20 pt-3">
                <h3 className="text-xs font-bold">Ascolto automatico</h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[16000, 24000, 32000].map((d) => (
                    <button
                      key={d}
                      disabled={listening}
                      onClick={() => setListenDuration(d)}
                      className={chip(listenDuration === d)}
                    >
                      {d / 1000}s
                    </button>
                  ))}
                  <button onClick={toggleListen} className={chip(listening)}>
                    {listening ? `Ferma (${Math.round(listenProgress * 100)}%)` : "Ascolta"}
                  </button>
                </div>
                {listenMsg && !listening && (
                  <p className="text-[11px] text-slate-500">{listenMsg}</p>
                )}
              </div>
              {songMode.song && (
                <div className="space-y-2 border-t border-white/20 pt-3">
                  <h3 className="text-xs font-bold">Trasposizione della song</h3>
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                    Tonalità
                    <select
                      value={rootPc}
                      onChange={(e) =>
                        updateSongSession({
                          transpose:
                            (((Number(e.target.value) - songMode.song!.keyPc) % 12) + 12) % 12,
                        })
                      }
                      className={field}
                      aria-label="Tonalità della song"
                    >
                      {KEYS.map((n, i) => (
                        <option key={n} value={i}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    I gradi ({songMode.degrees.join(" · ")}) non cambiano: cambia solo la tonalità.
                  </p>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                Tonica e scala restano bloccate: le mani scelgono solo il grado (1–7).
                {songMode.song ? " In Song Mode le imposta la canzone." : ""}
              </p>
            </div>
          </FloatingWindow>
        )}

        {panel === "arp" && (
          <FloatingWindow
            title="Arpeggiatore"
            subtitle={arpOn ? "Attivo" : "Spento"}
            onClose={() => setPanel(null)}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setArpOn((v) => !v)} className={chip(arpOn)}>
                  {arpOn ? "Arp ON" : "Arp OFF"}
                </button>
              </div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Tempo: <span className="text-slate-900">{bpm} BPM</span>
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="mt-1 w-full accent-sky-700"
                  aria-label="Tempo in BPM"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Divisione
                  <select
                    value={arpDiv}
                    onChange={(e) => setArpDiv(Number(e.target.value))}
                    className={field}
                    aria-label="Divisione arpeggio"
                  >
                    {(
                      [
                        ["1/4", 1],
                        ["1/8", 2],
                        ["1/8T", 3],
                        ["1/16", 4],
                      ] as const
                    ).map(([label, div]) => (
                      <option key={label} value={div}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  Pattern
                  <select
                    value={arpMode}
                    onChange={(e) => setArpMode(e.target.value as typeof arpMode)}
                    className={field}
                    aria-label="Pattern arpeggio"
                  >
                    {(
                      [
                        ["up", "Salita"],
                        ["down", "Discesa"],
                        ["updown", "Su e giù"],
                        ["octaves", "Ottave"],
                        ["random", "Casuale"],
                      ] as const
                    ).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-[11px] font-semibold text-slate-600">
                Gate: <span className="text-slate-900">{Math.round(arpGate * 100)}%</span>
                <input
                  type="range"
                  min={10}
                  max={140}
                  value={Math.round(arpGate * 100)}
                  onChange={(e) => setArpGate(Number(e.target.value) / 100)}
                  className="mt-1 w-full accent-sky-700"
                  aria-label="Lunghezza nota arpeggio"
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Gesto: chiudi e riapri velocemente entrambe le mani per accendere o spegnere
                l&apos;arp (tasto A). Nessun numero di dita attiva più l&apos;arpeggiatore.
              </p>
            </div>
          </FloatingWindow>
        )}

        {panel === "help" && (
          <FloatingWindow title="Guida rapida" onClose={() => setPanel(null)}>
            <div className="space-y-2">
              <ol className="space-y-1.5 text-[12px] text-slate-700">
                {STEPS.map((s, i) => (
                  <li key={i}>
                    <b>
                      {i + 1}. {s.t}
                    </b>{" "}
                    — {s.d}
                  </li>
                ))}
              </ol>
            </div>
          </FloatingWindow>
        )}
      </div>

      {/* barra inferiore: 5 slot fissi, Play sempre al centro */}
      <nav className="heaven-navbar">
        <div className="heaven-glass mx-auto grid max-w-md grid-cols-5 items-center gap-1 px-3 py-2">
          <Link
            to="/songs"
            aria-label="Heaven Songs"
            className={`heaven-nav ${songMode.song ? "heaven-nav-on" : ""}`}
          >
            <ListMusic className="h-5 w-5" />
            Songs
          </Link>

          <button
            onClick={() => setPanel((p) => (p === "scale" ? null : "scale"))}
            className={`heaven-nav ${panel === "scale" ? "heaven-nav-on" : ""}`}
          >
            <Music2 className="h-5 w-5" />
            Scale
          </button>

          <button
            onClick={running ? stop : start}
            aria-label={running ? "Stop" : "Play"}
            className={`heaven-play mx-auto ${running ? "heaven-play-on" : "heaven-play-breathe"}`}
          >
            {running ? <Square className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>

          <button
            onClick={() => setPanel((p) => (p === "arp" ? null : "arp"))}
            className={`heaven-nav ${panel === "arp" ? "heaven-nav-on" : ""}`}
          >
            <Repeat className="h-5 w-5" />
            Arp
          </button>

          <button
            onClick={() => setPanel((p) => (p === "sound" ? null : "sound"))}
            className={`heaven-nav ${panel === "sound" ? "heaven-nav-on" : ""}`}
          >
            <Sliders className="h-5 w-5" />
            Sound
          </button>
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
