import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crosshair,
  Hand,
  KeyboardMusic,
  Lock,
  Mic,
  Music4,

  Repeat,
  SlidersHorizontal,
  Square,
  Sparkles,
  Save,
  Trash2,
} from "lucide-react";


import {
  ARP_PATTERNS,
  CHORDS,
  DIVISIONS,
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
  type ChordId,
  type DivisionId,
  type InstrumentId,
  type ScaleId,
} from "@/lib/synth";
import { detectKey } from "@/lib/keyDetect";



const INSTRUMENT_GROUPS: { id: "zen" | "electro"; label: string }[] = [
  { id: "zen", label: "Zen / Calmi" },
  { id: "electro", label: "Elettronici / Bass" },
];

type HandState = { note: string; level: number; hand: string; inst: string };
type PlayMode = "single" | "split" | "pinch";
type PanelId = "sound" | "fx" | "scale" | "arp" | "calib" | "save";

const PRESETS_KEY = "skysynth.presets.v1";
const MAX_PRESETS = 40;

type PresetData = {
  mode: PlayMode;
  freeMode: "single" | "split";
  freePitch: "scale" | "glide";
  instrument: InstrumentId;
  leftInstrument: InstrumentId;
  rightInstrument: InstrumentId;
  scale: ScaleId;
  rootPc: number;
  arpLeft: boolean;
  arpRight: boolean;
  arpRate: number;
  arpPattern: ArpPatternId;
  arpGate: number;
  arpOctaves: number;
  arpSwing: number;
  bpm: number;
  arpSync: boolean;
  arpDivision: DivisionId;
  chord: ChordId;
  hold: boolean;
  reverb: number;
  delayMix: number;
  delayFeedback: number;
  delaySync: boolean;
  delayDivision: DivisionId;
  eqType: "lowpass" | "highpass";
  eqFreq: number;
  gestureMod: number;
};

type Preset = { id: string; name: string; savedAt: number; data: PresetData };
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

// ---- costellazioni che scorrono sullo sfondo ----
type ConstShape = { pts: [number, number][]; edges: [number, number][] };

const CONST_SHAPES: ConstShape[] = [
  // Orione
  {
    pts: [[0.1, 0], [0.32, 0.06], [0.05, 0.34], [0.24, 0.42], [0.42, 0.5], [0.6, 0.58], [0.5, 0.86], [0.78, 0.9]],
    edges: [[0, 1], [0, 2], [1, 5], [2, 3], [3, 4], [4, 5], [3, 6], [5, 7], [6, 7]],
  },
  // Cassiopea (W)
  {
    pts: [[0, 0.2], [0.25, 0.62], [0.5, 0.18], [0.75, 0.66], [1, 0.24]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  // Orsa maggiore
  {
    pts: [[0, 0.5], [0.18, 0.36], [0.38, 0.4], [0.55, 0.56], [0.72, 0.42], [0.9, 0.5], [1, 0.72]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [3, 6]],
  },
  // Lira / triangolo
  {
    pts: [[0.5, 0], [0.12, 0.4], [0.86, 0.44], [0.3, 0.9], [0.66, 0.96]],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4]],
  },
  // Scorpione
  {
    pts: [[0, 0.1], [0.16, 0.28], [0.34, 0.36], [0.52, 0.48], [0.66, 0.66], [0.6, 0.86], [0.4, 0.94], [0.28, 0.8]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  // Cigno (croce)
  {
    pts: [[0.5, 0], [0.5, 0.35], [0.5, 0.7], [0.5, 1], [0.12, 0.42], [0.88, 0.5]],
    edges: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]],
  },
];

type Constellation = {
  shape: ConstShape;
  x: number;
  y: number;
  scale: number;
  vx: number;
  vy: number;
  rot: number;
  phase: number;
  speed: number;
};

const spawnConstellation = (w: number, h: number, initial: boolean): Constellation => {
  const scale = (0.16 + Math.random() * 0.26) * Math.min(w, h) * 1.6;
  return {
    shape: CONST_SHAPES[Math.floor(Math.random() * CONST_SHAPES.length)]!,
    x: initial ? Math.random() * w : w + scale * 0.6,
    y: Math.random() * (h - scale * 0.4),
    scale,
    vx: -(0.06 + Math.random() * 0.12),
    vy: (Math.random() - 0.5) * 0.03,
    rot: (Math.random() - 0.5) * 0.5,
    phase: Math.random() * Math.PI * 2,
    speed: 0.0002 + Math.random() * 0.0004,
  };
};

const generateConstellations = (w: number, h: number): Constellation[] =>
  Array.from({ length: 5 }, () => spawnConstellation(w, h, true));


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
  const constellationsRef = useRef<Constellation[]>([]);
  const constLastRef = useRef<number>(0);

  const musicLevelRef = useRef(0);
  const lastSizeRef = useRef({ width: 0, height: 0 });



  const [panel, setPanel] = useState<PanelId | null>(null);
  const [mode, setMode] = useState<PlayMode>("split");
  const [freeMode, setFreeMode] = useState<Exclude<PlayMode, "pinch">>("split");
  const [freePitch, setFreePitch] = useState<"scale" | "glide">("scale");

  const [instrument, setInstrument] = useState<InstrumentId>("reese");
  const [leftInstrument, setLeftInstrument] = useState<InstrumentId>("violin");
  const [rightInstrument, setRightInstrument] = useState<InstrumentId>("winds");
  const [scale, setScale] = useState<ScaleId>("minorPent");
  const [rootPc, setRootPc] = useState(2);
  const [arpLeft, setArpLeft] = useState(false);
  const [arpRight, setArpRight] = useState(false);
  const [arpRate, setArpRate] = useState(8);
  const [arpPattern, setArpPattern] = useState<ArpPatternId>("up");
  const [arpGate, setArpGate] = useState(90);
  const [arpOctaves, setArpOctaves] = useState(1);
  const [arpSwing, setArpSwing] = useState(0);
  const [bpm, setBpm] = useState(100);
  const [arpSync, setArpSync] = useState(true);
  const [arpDivision, setArpDivision] = useState<DivisionId>("1/8");

  const [chord, setChord] = useState<ChordId>("off");
  const [hold, setHold] = useState(false);

  const [reverb, setReverb] = useState(93);
  const [delayMix, setDelayMix] = useState(28);
  const [delayFeedback, setDelayFeedback] = useState(35);
  const [delaySync, setDelaySync] = useState(true);
  const [delayDivision, setDelayDivision] = useState<DivisionId>("1/8");
  const [eqType, setEqType] = useState<"lowpass" | "highpass">("lowpass");
  const [eqFreq, setEqFreq] = useState(1200);
  const [gestureMod, setGestureMod] = useState(40);


  const [listening, setListening] = useState(false);
  const [listenProgress, setListenProgress] = useState(0);
  const [listenLevel, setListenLevel] = useState(0);
  const [listenDuration, setListenDuration] = useState(16000);
  const [listenMsg, setListenMsg] = useState<string | null>(null);
  const listenAbortRef = useRef<AbortController | null>(null);

  const runListening = useCallback(async (durationMs: number) => {
    listenAbortRef.current?.abort();
    const ac = new AbortController();
    listenAbortRef.current = ac;
    setListening(true);
    setListenProgress(0);
    setListenLevel(0);
    setListenMsg(null);
    try {
      const res = await detectKey({
        durationMs,
        signal: ac.signal,
        onProgress: ({ progress, level }) => {
          setListenProgress(progress);
          setListenLevel(level);
        },
      });
      // applica subito tonica e scala (anche mentre stai suonando)
      setRootPc(res.rootPc);
      setScale(res.scaleId);
      engineRef.current?.setScale(scaleSteps(res.scaleId), res.rootPc);
      const scaleName = SCALES.find((s) => s.id === res.scaleId)?.name ?? "";
      const name = `${NOTE_NAMES[res.rootPc]} ${scaleName}`;
      setListenMsg(
        res.confidence > 0.3
          ? `Applicato: ${name}`
          : `Applicato: ${name} — confidenza bassa, riprova con più suono`,
      );
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") setListenMsg("Ascolto interrotto.");
      else if (err.name === "NotAllowedError")
        setListenMsg("Permesso microfono negato.");
      else setListenMsg(err.message || "Non è stato possibile ascoltare.");
    } finally {
      setListening(false);
      setListenProgress(0);
      setListenLevel(0);
    }
  }, []);

  const startListening = useCallback(() => runListening(listenDuration), [runListening, listenDuration]);
  const toggleListen = useCallback(() => {
    if (listening) listenAbortRef.current?.abort();
    else void runListening(listenDuration);
  }, [listening, runListening, listenDuration]);



  useEffect(() => () => listenAbortRef.current?.abort(), []);


  const [sensitivity, setSensitivity] = useState(0); // -15..+15 (%)
  const [calibPhase, setCalibPhase] = useState<CalibPhase>("idle");
  const [calib, setCalib] = useState({ ...DEFAULT_CALIB });
  const [calibrated, setCalibrated] = useState(false);

  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [hands, setHands] = useState<HandState[]>([]);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetMsg, setPresetMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      if (raw) setPresets(JSON.parse(raw) as Preset[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persistPresets = (list: Preset[]) => {
    setPresets(list);
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const currentPreset = (): PresetData => ({
    mode,
    freeMode,
    freePitch,
    instrument,
    leftInstrument,
    rightInstrument,
    scale,
    rootPc,
    arpLeft,
    arpRight,
    arpRate,
    arpPattern,
    arpGate,
    arpOctaves,
    arpSwing,
    bpm,
    arpSync,
    arpDivision,
    chord,
    hold,
    reverb,
    delayMix,
    delayFeedback,
    delaySync,
    delayDivision,
    eqType,
    eqFreq,
    gestureMod,
  });

  const savePreset = () => {
    const name = presetName.trim() || `Progetto ${presets.length + 1}`;
    const existing = presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const entry: Preset = {
      id: existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      savedAt: Date.now(),
      data: currentPreset(),
    };
    if (existing) {
      persistPresets(presets.map((p) => (p.id === existing.id ? entry : p)));
      setPresetMsg(`"${name}" aggiornato`);
    } else {
      if (presets.length >= MAX_PRESETS) {
        setPresetMsg(`Limite di ${MAX_PRESETS} progetti raggiunto: cancellane uno.`);
        return;
      }
      persistPresets([entry, ...presets]);
      setPresetMsg(`"${name}" salvato`);
    }
    setPresetName("");
  };

  const deletePreset = (id: string) => {
    persistPresets(presets.filter((p) => p.id !== id));
    setPresetMsg("Progetto cancellato");
  };

  const loadPreset = (p: Preset) => {
    const d = p.data;
    setMode(d.mode);
    setFreeMode(d.freeMode);
    setFreePitch(d.freePitch);
    setInstrument(d.instrument);
    engineRef.current?.setInstrument(d.instrument);
    setLeftInstrument(d.leftInstrument);
    setRightInstrument(d.rightInstrument);
    setScale(d.scale);
    setRootPc(d.rootPc);
    setArpLeft(d.arpLeft);
    setArpRight(d.arpRight);
    setArpRate(d.arpRate);
    setArpPattern(d.arpPattern);
    setArpGate(d.arpGate);
    setArpOctaves(d.arpOctaves);
    setArpSwing(d.arpSwing);
    setBpm(d.bpm);
    setArpSync(d.arpSync);
    setArpDivision(d.arpDivision);
    setChord(d.chord);
    setHold(d.hold);
    setReverb(d.reverb);
    setDelayMix(d.delayMix);
    setDelayFeedback(d.delayFeedback);
    setDelaySync(d.delaySync);
    setDelayDivision(d.delayDivision);
    setEqType(d.eqType);
    setEqFreq(d.eqFreq);
    setGestureMod(d.gestureMod);
    setPresetName(p.name);
    setPresetMsg(`"${p.name}" caricato`);
  };



  // keep latest settings readable inside the rAF loop
  const cfg = useRef({
    mode,
    instrument,
    leftInstrument,
    rightInstrument,
    arpLeft,
    arpRight,
    freePitch,
    gestureMod,
  });
  cfg.current = {
    mode,
    instrument,
    leftInstrument,
    rightInstrument,
    arpLeft,
    arpRight,
    freePitch,
    gestureMod,
  };


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
      gate: arpGate / 100,
      octaves: arpOctaves,
      swing: arpSwing / 100,
      sync: arpSync,
      division: arpDivision,
    });
  }, [arpLeft, arpRight, arpRate, arpPattern, arpGate, arpOctaves, arpSwing, arpSync, arpDivision]);

  useEffect(() => {
    engineRef.current?.setTempo(bpm);
  }, [bpm]);

  useEffect(() => {
    engineRef.current?.setChord(chord);
  }, [chord]);

  useEffect(() => {
    engineRef.current?.setHold(hold);
  }, [hold]);

  useEffect(() => {
    engineRef.current?.setReverb(reverb / 100);
  }, [reverb]);

  useEffect(() => {
    engineRef.current?.setDelay({
      mix: delayMix / 100,
      feedback: delayFeedback / 100,
      sync: delaySync,
      division: delayDivision,
    });
  }, [delayMix, delayFeedback, delaySync, delayDivision]);

  useEffect(() => {
    engineRef.current?.setFilterMod(0.5, gestureMod / 100);
  }, [gestureMod]);

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
      ctx.fillStyle = "rgb(9, 18, 38)";
      ctx.fillRect(0, 0, w, h);

      // stelline lontane che respirano col volume
      const ml = musicLevelRef.current;
      const baseStarAlpha = 0.1;
      const stars = starsRef.current;
      ctx.save();
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]!;
        const breath = 0.5 + 0.5 * Math.sin(now * 0.0025 * s.depth + s.phase);
        const alpha = baseStarAlpha + 0.1 * s.depth * breath + 0.5 * ml * s.depth * breath;

        ctx.fillStyle = `rgba(240, 214, 160, ${Math.min(0.85, alpha)})`;
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
        freePitch: fp,
        gestureMod: gm,
      } = cfg.current;

      let maxSoundLevel = 0;
      let maxMod = 0;
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
              else engine.noteOnChord(vid, midi, degree, level, bright, inst);
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
          const shift = INSTRUMENT_SHIFT[inst] ?? 0;
          const midi = degreeToMidi(degree, engine.scale, engine.rootPc, shift);
          // glide: altezza continua tra la prima e l'ultima nota della stessa estensione
          const lowMidi = degreeToMidi(0, engine.scale, engine.rootPc, shift);
          const highMidi = degreeToMidi(STEPS - 1, engine.scale, engine.rootPc, shift);
          const glideMidi = lowMidi + Math.min(1, Math.max(0, x)) * (highMidi - lowMidi);
          const playMidi = fp === "glide" ? glideMidi : midi;
          // apertura della mano -> brillantezza / filtro
          const span = Math.hypot(thumbTip.x - middleTip.x, thumbTip.y - middleTip.y) / handSize;
          const open = Math.min(1, Math.max(0, (span - thrOn) / Math.max(0.2, thrOff * 1.8)));
          const freeBright = 0.05 + open * 0.95;
          // altezza -> volume: in basso piano, al 70% dello schermo pieno
          const height = 1 - Math.min(1, Math.max(0, indexTip.y));
          const level = Math.min(1, Math.max(0, height / 0.7));

          if (level > 0.06) {
            soundLevel = level;
            if (arp) engine.setArpTarget(id, degree, level, freeBright, inst);
            else engine.noteOnChord(id, playMidi, degree, level, freeBright, inst);
            next.push({
              note: midiToName(Math.round(playMidi)),
              level,
              hand: isRight ? "Lato B" : "Lato A",
              inst: INSTRUMENTS.find((x2) => x2.id === inst)?.name ?? "",
            });
          } else {
            active.delete(id);
          }
        }


        maxSoundLevel = Math.max(maxSoundLevel, soundLevel);
        if (soundLevel > 0) maxMod = Math.max(maxMod, bright);

        // scheletro ben visibile
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowBlur = 18;
        ctx.shadowColor = `hsla(${baseHue}, 80%, 55%, 0.9)`;
        ctx.strokeStyle = `hsla(${baseHue}, 72%, 62%, ${0.55 + soundLevel * 0.45})`;
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
        ctx.strokeStyle = "rgba(247, 233, 200, 0.92)";
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
        ctx.shadowColor = `hsla(${baseHue}, 80%, 60%, 0.9)`;
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(247, 233, 200, 0.95)";
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
            grd.addColorStop(0, `hsla(${gl.hue}, 90%, 92%, ${0.9 * gl.level})`);
            grd.addColorStop(0.35, `hsla(${gl.hue}, 85%, 62%, ${0.5 * gl.level})`);
            grd.addColorStop(1, `hsla(${gl.hue}, 85%, 50%, 0)`);
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
      if (gm > 0) engine.setFilterMod(maxMod, gm / 100);

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
      engine.bpm = bpm;
      engine.delayMix = delayMix / 100;
      engine.delayFeedback = delayFeedback / 100;
      engine.delaySync = delaySync;
      engine.delayDivision = delayDivision;
      engine.chordMode = chord;
      engine.hold = hold;
      engine.filterModAmount = gestureMod / 100;
      await engine.start();
      engine.setArp({
        enabled: arpLeft || arpRight,
        rate: arpRate,
        degrees: ARP_PATTERNS.find((p) => p.id === arpPattern)?.degrees ?? [0],
        random: arpPattern === "random",
        gate: arpGate / 100,
        octaves: arpOctaves,
        swing: arpSwing / 100,
        sync: arpSync,
        division: arpDivision,
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
  }, [instrument, scale, rootPc, arpLeft, arpRight, arpRate, arpPattern, arpGate, arpOctaves, arpSwing, arpSync, arpDivision, bpm, chord, hold, delayMix, delayFeedback, delaySync, delayDivision, gestureMod, reverb, eqType, eqFreq, loop]);

  const pickInstrument = (id: InstrumentId) => {
    setInstrument(id);
    engineRef.current?.setInstrument(id);
  };

  const selectClass =
    "w-full rounded-sm border border-border bg-background/60 px-3 py-2 text-sm tracking-wide text-foreground";

  const panelBtn = (id: PanelId, label: string, Icon: any) => (
    <button
      key={id}
      onClick={() => setPanel((p) => (p === id ? null : id))}
      aria-label={label}
      aria-pressed={panel === id}
      className={`flex min-w-[64px] flex-1 flex-col items-center gap-1 rounded-sm border px-2 py-3 text-[10px] uppercase tracking-[0.18em] transition ${
        panel === id
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-card/70 text-muted-foreground"
      }`}
    >
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5">
      <header className="text-center">
        <div className="celestial-rule mx-auto mb-3 w-2/3" />
        <h1 className="font-display text-xl leading-tight tracking-[0.16em] text-foreground sm:text-2xl">
          Steph Evo&apos;s <span className="text-primary">Sky Synth</span>
        </h1>
        <p className="mt-2 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Carta sonora · Ed. I
        </p>
        <div className="celestial-rule mx-auto mt-3 w-2/3" />
      </header>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={() => setMode("pinch")}
          aria-label="Tocco note"
          className={
            (mode === "pinch"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card/60 text-muted-foreground") +
            " flex items-center gap-2 rounded-sm border px-4 py-2 text-[10px] uppercase tracking-[0.18em]"
          }
        >
          <Sparkles className="h-5 w-5" />
          Tocco
        </button>
        <button
          onClick={() => setMode(freeMode)}
          aria-label="Libero"
          className={
            (mode !== "pinch"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card/60 text-muted-foreground") +
            " flex items-center gap-2 rounded-sm border px-4 py-2 text-[10px] uppercase tracking-[0.18em]"
          }
        >
          <Hand className="h-5 w-5" />
          Libero
        </button>
        <button
          onClick={toggleListen}
          aria-label={listening ? "Ferma il microfono" : "Rileva scala dal microfono"}
          className={
            (listening
              ? "border-primary bg-primary/15 text-primary animate-pulse"
              : "border-border bg-card/60 text-muted-foreground") +
            " flex items-center gap-2 rounded-sm border px-4 py-2 text-[10px] uppercase tracking-[0.18em]"
          }
        >
          {listening ? (
            <span className="h-4 w-4 rounded-[2px] bg-primary" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
          {listening
            ? `Stop ${Math.ceil((listenDuration / 1000) * (1 - listenProgress))}s`
            : "Rileva"}
        </button>
        <button
          onClick={() => setHold((v) => !v)}
          aria-label="Mantieni le note"
          aria-pressed={hold}
          className={
            (hold
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card/60 text-muted-foreground") +
            " flex items-center gap-2 rounded-sm border px-4 py-2 text-[10px] uppercase tracking-[0.18em]"
          }
        >
          <Lock className="h-5 w-5" />
          Hold
        </button>

      </div>


      <div className="celestial-frame mt-3 rounded-sm shadow-glow">

        <div className="relative aspect-[3/4] w-full overflow-hidden bg-stage sm:aspect-[4/3]">
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
              {(listening || listenMsg) && (
                <span
                  className={`rounded-sm border px-3 py-1 text-[9px] tracking-wide backdrop-blur ${
                    listening
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background/70 text-muted-foreground"
                  }`}
                >
                  {listening
                    ? `🎙️ Ascolto ${Math.ceil((listenDuration / 1000) * (1 - listenProgress))}s…`
                    : listenMsg}
                </span>
              )}
              {hands.length === 0 ? (
                <span className="rounded-sm border border-border bg-background/70 px-3 py-1 text-[11px] tracking-wide text-muted-foreground backdrop-blur">
                  Pronto
                </span>
              ) : (
                hands.map((h, i) => (
                  <span
                    key={i}
                    className="rounded-sm border border-border bg-background/70 px-3 py-1 text-[11px] tracking-wide text-foreground backdrop-blur"
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
        {panelBtn("save", "Progetti", Save)}

        {running && (
          <button
            onClick={stop}
            aria-label="Stop"
            className="flex flex-1 flex-col items-center gap-1 rounded-sm border border-border bg-card/70 px-2 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            <Square className="h-6 w-6" />
            Stop
          </button>
        )}
      </div>

      {/* Pannelli */}
      {panel === "sound" && (
        <div className="mt-3 celestial-panel rounded-sm p-4">
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
                onClick={() => {
                  setMode(id);
                  if (id !== "pinch") setFreeMode(id);
                }}

                className={mode === id ? "instrument-card instrument-card-active" : "instrument-card"}
              >
                <span className="font-display text-lg">{name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{blurb}</span>
              </button>
            ))}
          </div>

          {mode !== "split" ? (
            <div className="mt-3 space-y-3">
              {INSTRUMENT_GROUPS.map((g) => (
                <div key={g.id}>
                  <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {g.label}
                  </span>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {INSTRUMENTS.filter((i) => i.group === g.id).map((i) => (
                      <button
                        key={i.id}
                        onClick={() => pickInstrument(i.id)}
                        className={
                          instrument === i.id
                            ? "instrument-card instrument-card-active"
                            : "instrument-card"
                        }
                      >
                        <span className="font-display text-lg">{i.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{i.blurb}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
                  {INSTRUMENT_GROUPS.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      {INSTRUMENTS.filter((i) => i.group === g.id).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </optgroup>
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
                  {INSTRUMENT_GROUPS.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      {INSTRUMENTS.filter((i) => i.group === g.id).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Accordi
              </label>
              <select
                className={`mt-2 ${selectClass}`}
                value={chord}
                onChange={(e) => setChord(e.target.value as ChordId)}
              >
                {CHORDS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Le note extra restano sempre dentro la scala scelta.
              </p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Hold
              </label>
              <button
                onClick={() => setHold((v) => !v)}
                aria-pressed={hold}
                className={`mt-2 w-full ${hold ? "btn-hero" : "btn-ghost"}`}
              >
                {hold ? "Note mantenute" : "Hold off"}
              </button>
              <p className="mt-1 text-xs text-muted-foreground">
                Con Hold attivo le note continuano a suonare finché non lo disattivi.
              </p>
            </div>
          </div>

        </div>
      )}


      {panel === "scale" && (
        <div className="mt-3 grid gap-3 celestial-panel rounded-sm p-4 sm:grid-cols-2">
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

          <div className="sm:col-span-2 celestial-rule" />

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Intonazione (modalità Libero)
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                { id: "scale", name: "Segui la scala" },
                { id: "glide", name: "Libera (glissando)" },
              ] as const).map((o) => (
                <button
                  key={o.id}
                  onClick={() => setFreePitch(o.id)}
                  aria-pressed={freePitch === o.id}
                  className={`rounded-sm border px-3 py-2 text-sm transition-colors ${
                    freePitch === o.id
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2 celestial-rule" />

          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Ascolto automatico
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={listening ? () => listenAbortRef.current?.abort() : startListening}
                className={listening ? "btn-ghost" : "btn-hero"}
              >
                <Mic className="mr-2 inline h-4 w-4" />
                {listening ? "Annulla" : "Ascolta"}
              </button>
              <select
                className={selectClass}
                value={listenDuration}
                disabled={listening}
                onChange={(e) => setListenDuration(Number(e.target.value))}
              >
                <option value={16000}>16 s</option>
                <option value={24000}>24 s</option>
                <option value={32000}>32 s</option>
              </select>
              {listening && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.ceil((listenDuration / 1000) * (1 - listenProgress))} s
                </span>
              )}
            </div>
            {listening && (
              <div className="mt-3 space-y-2">
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-100"
                    style={{ width: `${listenProgress * 100}%` }}
                  />
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.min(100, listenLevel * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {!listening && listenMsg && (
              <p className="mt-2 text-xs text-muted-foreground">{listenMsg}</p>
            )}
          </div>
        </div>

      )}

      {panel === "arp" && (
        <div className="mt-3 celestial-panel rounded-sm p-4">
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
                Tempo: {bpm} BPM
              </label>
              <input
                type="range"
                min={40}
                max={200}
                step={1}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Sincronizzazione
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setArpSync(true)}
                  aria-pressed={arpSync}
                  className={arpSync ? "btn-hero" : "btn-ghost"}
                >
                  Sync
                </button>
                <button
                  onClick={() => setArpSync(false)}
                  aria-pressed={!arpSync}
                  className={!arpSync ? "btn-hero" : "btn-ghost"}
                >
                  Libero
                </button>
              </div>
            </div>
            {arpSync ? (
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Divisione
                </label>
                <select
                  className={`mt-2 ${selectClass}`}
                  value={arpDivision}
                  onChange={(e) => setArpDivision(e.target.value as DivisionId)}
                >
                  {DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
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
            )}

            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Gate: {arpGate}%
              </label>
              <input
                type="range"
                min={10}
                max={140}
                step={5}
                value={arpGate}
                onChange={(e) => setArpGate(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Ottave: {arpOctaves}
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={arpOctaves}
                onChange={(e) => setArpOctaves(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Swing: {arpSwing}%
              </label>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={arpSwing}
                onChange={(e) => setArpSwing(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)]"
              />
            </div>
          </div>

        </div>
      )}

      {panel === "fx" && (
        <div className="mt-3 grid gap-4 celestial-panel rounded-sm p-4 sm:grid-cols-3">
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
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Delay mix: {delayMix}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={delayMix}
              onChange={(e) => setDelayMix(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Delay feedback: {delayFeedback}%
            </label>
            <input
              type="range"
              min={0}
              max={85}
              step={1}
              value={delayFeedback}
              onChange={(e) => setDelayFeedback(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Tempo delay
            </label>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setDelaySync(true)}
                aria-pressed={delaySync}
                className={delaySync ? "btn-hero" : "btn-ghost"}
              >
                Sync
              </button>
              <button
                onClick={() => setDelaySync(false)}
                aria-pressed={!delaySync}
                className={!delaySync ? "btn-hero" : "btn-ghost"}
              >
                Libero
              </button>
            </div>
            {delaySync && (
              <select
                className={`mt-2 ${selectClass}`}
                value={delayDivision}
                onChange={(e) => setDelayDivision(e.target.value as DivisionId)}
              >
                {DIVISIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">
              Modulazione gesto → filtro: {gestureMod}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={gestureMod}
              onChange={(e) => setGestureMod(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--primary)]"
            />
          </div>
        </div>
      )}


      {panel === "calib" && (
        <div className="mt-3 celestial-panel rounded-sm p-4">
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

      {panel === "save" && (
        <div className="mt-3 celestial-panel rounded-sm p-4">
          <p className="text-sm text-muted-foreground">
            Salva tutte le impostazioni correnti (suoni, scala, arp, effetti) e richiamale prima di
            uno show. Fino a {MAX_PRESETS} progetti.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nome del progetto"
              maxLength={40}
              className="min-w-[180px] flex-1 rounded-sm border border-border bg-background/60 px-3 py-2 text-sm text-foreground"
            />
            <button onClick={savePreset} className="btn-hero flex items-center gap-2">
              <Save className="h-4 w-4" />
              Salva
            </button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {presetMsg ?? `${presets.length}/${MAX_PRESETS} progetti salvati`}
          </p>

          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {presets.length === 0 && (
              <p className="text-xs text-muted-foreground">Nessun progetto salvato.</p>
            )}
            {presets.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-sm border border-border bg-card/60 px-3 py-2"
              >
                <button
                  onClick={() => loadPreset(p)}
                  className="flex-1 text-left"
                  aria-label={`Apri ${p.name}`}
                >
                  <span className="block text-sm text-foreground">{p.name}</span>
                  <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                    {new Date(p.savedAt).toLocaleString()}
                  </span>
                </button>
                <button
                  onClick={() => deletePreset(p.id)}
                  aria-label={`Cancella ${p.name}`}
                  className="rounded-sm border border-border p-2 text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>


  );
}

