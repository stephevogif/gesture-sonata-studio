/**
 * SOUND CONSTELLATION — one screen for instruments (up to 4) and their FX.
 *
 * The MASTER node is the sun at the centre. Each instrument is a planet: its
 * DISTANCE from the sun is its level in the mix. Tapping a node selects it and
 * opens a scrollable parameter sheet below; dragging a node adjusts volume
 * (planet) or effect amount (moon). The selected node lights up with a glowing
 * outline so you always know what you are touching.
 *
 * Purely presentational: it edits an immutable `MixState` through `onChange`,
 * so the audio engine stays the only owner of the DSP graph.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Sparkles, Wand2, X } from "lucide-react";
import Knob from "@/components/sound/Knob";

import { FX_CATALOG, fxDef, type FxParamDef } from "@/core/audio/fxCatalog";
import { GATE_PRESETS, gateGlyph, type GatePresetId } from "@/core/audio/gatePresets";
import type { FxTypeId } from "@/core/audio/fx";
import { INSTRUMENTS, type InstrumentId } from "@/core/audio/presets";
import {
  MAX_LAYERS,
  addFx,
  addLayer,
  fxListOf,
  insertLayer,
  patchFx,
  patchLayer,
  removeFx,
  removeLayer,
  replaceFxChain,
  setFxParam,
  cloneMix,
  type MixState,
} from "@/core/sound/mix";
import {
  deletePreset,
  exportPresetFile,
  importPresetFile,
  listPresets,
  savePreset,
  MAX_PRESETS,
  type SoundPreset,
} from "@/core/sound/library";
import { FACTORY_PRESETS } from "@/core/sound/factoryPresets";
import {
  HAND_SOURCES,
  HAND_TARGETS,
  type HandControl,
  type HandSource,
  type HandTargetId,
} from "@/core/sound/handControl";

const VIEW = 320;
const C = VIEW / 2;
const SUN_R = 30;
const MIN_R = 52;
const MAX_R = 122;
const FX_MIN = 24;
const FX_MAX = 54;
const MOVE_THRESHOLD = 3;

const INSTRUMENT_RGB = ["255, 216, 150", "168, 214, 255", "205, 180, 255", "170, 240, 205"];

const instrumentName = (id: InstrumentId) =>
  INSTRUMENTS.find((i) => i.id === id)?.name ?? String(id);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function normParam(def: FxParamDef, value: number) {
  if (def.curve === "log") {
    const lo = Math.log(Math.max(1e-4, def.min));
    const hi = Math.log(Math.max(1e-4, def.max));
    return clamp01((Math.log(Math.max(1e-4, value)) - lo) / (hi - lo));
  }
  return clamp01((value - def.min) / (def.max - def.min));
}

function denormParam(def: FxParamDef, t: number) {
  const k = clamp01(t);
  if (def.curve === "log") {
    const lo = Math.log(Math.max(1e-4, def.min));
    const hi = Math.log(Math.max(1e-4, def.max));
    return Math.exp(lo + (hi - lo) * k);
  }
  return def.min + (def.max - def.min) * k;
}

function formatParam(def: FxParamDef, value: number) {
  if (def.toggle) return value > 0.5 ? "ON" : "OFF";
  if (def.unit === "Hz")
    return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
  if (def.unit === "s") return `${Math.round(value * 1000)} ms`;
  if (def.unit === "×") return `${value.toFixed(2)}×`;
  return value >= 10 ? value.toFixed(0) : value.toFixed(2);
}

type Drag =
  | { kind: "master"; sx: number; sy: number }
  | { kind: "layer"; layerId: string; sx: number; sy: number }
  | { kind: "fx"; layerId: string | null; fxId: string; ox: number; oy: number; sx: number; sy: number };

type NodeRef =
  | { kind: "master" }
  | { kind: "layer"; id: string }
  | { kind: "fx"; id: string };

type Anchor = { kind: "master" } | { kind: "layer"; id: string };

type Props = {
  state: MixState;
  onChange: (next: MixState) => void;
  tone?: "light" | "dark";
  /** hides the instrument planets: only the MASTER sun and its FX moons */
  masterOnly?: boolean;
  handControl?: HandControl;
  onHandControlChange?: (next: HandControl) => void;
  /** espressione continua della mano: rotazione, apertura, altezza */
  expression?: Expression;
  onExpressionChange?: (next: Expression) => void;
  /** tempo di legato fra gli accordi, in ms */
  legatoMs?: number;
  onLegatoChange?: (ms: number) => void;
};

export default function SoundConstellation({
  state,
  onChange,
  tone = "light",
  masterOnly = false,
  handControl,
  onHandControlChange,
  expression,
  onExpressionChange,
  legatoMs,
  onLegatoChange,
}: Props) {

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const initial: Anchor =
    masterOnly || !state.instruments[0]
      ? { kind: "master" }
      : { kind: "layer", id: state.instruments[0].id };
  const [anchor, setAnchor] = useState<Anchor>(initial);
  /** all'apertura nessuna finestra parametri: si vede solo la costellazione */
  const [selected, setSelected] = useState<NodeRef | null>(null);
  const [picker, setPicker] = useState<"sound" | "fx" | null>(null);
  /** nodo per cui è stata chiesta la ✕ di eliminazione (chiede conferma) */
  const [confirmDel, setConfirmDel] = useState<NodeRef | null>(null);


  /* ————— libreria preset ————— */
  const [presets, setPresets] = useState<SoundPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  /** "" = salva la catena FX corrente, altrimenti l'id dello strumento */
  const [presetTarget, setPresetTarget] = useState("console");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetQuery, setPresetQuery] = useState("");
  useEffect(() => setPresets(listPresets()), []);

  const layers = state.instruments;
  const anchorLayer = anchor.kind === "layer" ? layers.find((l) => l.id === anchor.id) ?? null : null;
  const fxList = fxListOf(state, anchorLayer ? anchorLayer.id : null);
  const fxParentId = anchor.kind === "master" ? null : anchor.id;

  const selectedFxInfo = useMemo(() => {
    if (selected?.kind !== "fx") return null;
    const inMaster = state.master.find((f) => f.id === selected.id);
    if (inMaster) return { fx: inMaster, parent: null as string | null };
    for (const l of state.instruments) {
      const fx = l.effects.find((f) => f.id === selected.id);
      if (fx) return { fx, parent: l.id };
    }
    return null;
  }, [selected, state]);

  const geometry = useMemo(
    () =>
      layers.map((layer, i) => {
        const angle = ((i * 90 - 45) * Math.PI) / 180;
        const r = MIN_R + (MAX_R - MIN_R) * clamp01(layer.gain);
        return {
          layer,
          angle: i * 90 - 45,
          x: C + Math.cos(angle) * r,
          y: C + Math.sin(angle) * r,
          rgb: INSTRUMENT_RGB[i % INSTRUMENT_RGB.length]!,
        };
      }),
    [layers],
  );

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: C, y: C };
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW,
      y: ((clientY - rect.top) / rect.height) * VIEW,
    };
  }, []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const frameRef = useRef(0);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);

  const applyPending = useCallback(() => {
    frameRef.current = 0;
    const drag = dragRef.current;
    const point = pendingRef.current;
    pendingRef.current = null;
    if (!drag || drag.kind === "master" || !point) return;
    const current = stateRef.current;
    if (drag.kind === "layer") {
      const dist = Math.hypot(point.x - C, point.y - C);
      const gain = clamp01((dist - MIN_R) / (MAX_R - MIN_R));
      const next = Number(gain.toFixed(2));
      const layer = current.instruments.find((l) => l.id === drag.layerId);
      if (!layer || layer.gain === next) return;
      onChange(patchLayer(current, drag.layerId, { gain: next }));
      return;
    }
    const dist = Math.hypot(point.x - drag.ox, point.y - drag.oy);
    const amount = Number(clamp01((dist - FX_MIN) / (FX_MAX - FX_MIN)).toFixed(2));
    const fx = fxListOf(current, drag.layerId).find((f) => f.id === drag.fxId);
    if (!fx || fx.amount === amount) return;
    onChange(patchFx(current, drag.layerId, drag.fxId, { amount }));
  }, [onChange]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const { x, y } = toSvg(e.clientX, e.clientY);
      if (!movedRef.current) {
        const dist = Math.hypot(x - drag.sx, y - drag.sy);
        if (dist > MOVE_THRESHOLD) movedRef.current = true;
      }
      if (drag.kind === "master") return;
      pendingRef.current = { x, y };
      if (!frameRef.current) frameRef.current = requestAnimationFrame(applyPending);
    },
    [applyPending, toSvg],
  );

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    const wasMoved = movedRef.current;
    dragRef.current = null;
    pendingRef.current = null;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    if (drag && !wasMoved) {
      if (drag.kind === "master") {
        setAnchor({ kind: "master" });
        setSelected({ kind: "master" });
      } else if (drag.kind === "layer") {
        setAnchor({ kind: "layer", id: drag.layerId });
        setSelected({ kind: "layer", id: drag.layerId });
      } else if (drag.kind === "fx") {
        setSelected({ kind: "fx", id: drag.fxId });
      }
      setPicker(null);
      setPresetsOpen(false);
    }
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const deleteLayer = (id: string) => {
    const next = removeLayer(state, id);
    onChange(next);
    setAnchor((a) =>
      a.kind === "layer" && a.id === id ? { kind: "layer", id: next.instruments[0]?.id ?? "" } : a,
    );
    setSelected((s) => {
      if (s?.kind === "layer" && s.id === id) return null;
      if (s?.kind === "fx") {
        const wasInLayer = state.instruments
          .find((l) => l.id === id)
          ?.effects.some((f) => f.id === s.id);
        return wasInLayer ? null : s;
      }
      return s;
    });
  };

  const deleteFx = (id: string) => {
    const parent =
      state.master.some((f) => f.id === id)
        ? null
        : (state.instruments.find((l) => l.effects.some((f) => f.id === id))?.id ?? null);
    onChange(removeFx(state, parent, id));
    setSelected((s) => (s?.kind === "fx" && s.id === id ? null : s));
  };


  const anchorGeo = anchorLayer
    ? geometry.find((g) => g.layer.id === anchorLayer.id)
    : { x: C, y: C, angle: 0, rgb: "255, 236, 190", layer: null };

  const masterFxList = state.master;
  const dark = tone === "dark";

  /** l'icona in alto apre la finestra PRESET (nessun salvataggio silenzioso) */
  const openPresets = () => {
    setPicker(null);
    setSelected(null);
    setPresetsOpen(true);
  };

  const saveCurrentPreset = () => {
    const layer = presetTarget && presetTarget !== "console"
      ? layers.find((l) => l.id === presetTarget)
      : undefined;
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const fallback =
      presetTarget === "console" ? `Console ${time}` : `${layer ? instrumentName(layer.instrument) : "FX"} ${time}`;
    const name = presetName.trim() || fallback;
    setPresets(
      presetTarget === "console"
        ? savePreset({ name, kind: "console", mix: state })
        : layer
          ? savePreset({ name, kind: "layer", layer })
          : savePreset({ name, kind: "fx", effects: fxList }),
    );
    setPresetName("");
  };


  const confirmLabel =
    confirmDel?.kind === "layer"
      ? instrumentName(layers.find((l) => l.id === confirmDel.id)?.instrument ?? "piano")
      : confirmDel?.kind === "fx"
        ? fxDef(
            (state.master.find((f) => f.id === confirmDel.id) ??
              state.instruments.flatMap((l) => l.effects).find((f) => f.id === confirmDel.id))
              ?.type ?? "reverb",
          ).label
        : "";

  return (
    <div className={`sc ${dark ? "sc-dark" : "sc-light"}`}>
      <div className="sc-pop-head">
        <span>EFFECT CONSOLE</span>
        <button className="sc-chip sc-chip-on" aria-label="Salva preset" onClick={openPresets}>
          <Save className="h-3.5 w-3.5" />
        </button>
      </div>

      {confirmDel && (
        <div className="sc-confirm">
          Eliminare <b>{confirmLabel}</b>?
          <div className="mt-1.5 flex gap-1.5">
            <button
              className="sc-danger"
              onClick={() => {
                if (confirmDel.kind === "layer") deleteLayer(confirmDel.id);
                else if (confirmDel.kind === "fx") deleteFx(confirmDel.id);
                setConfirmDel(null);
              }}
            >
              Elimina
            </button>
            <button className="sc-chip" onClick={() => setConfirmDel(null)}>
              Annulla
            </button>
          </div>
        </div>
      )}

      <div className="sc-stage">

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="mx-auto w-full max-w-[20rem] touch-none select-none"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
          role="group"
          aria-label="Sound Constellation"
        >
          <defs>
            <radialGradient id="sc-sun">
              <stop offset="0%" stopColor="rgba(255,232,175,0.6)" />
              <stop offset="100%" stopColor="rgba(255,232,175,0)" />
            </radialGradient>
          </defs>

          {[0.34, 0.67, 1].map((k) => (
            <circle
              key={k}
              cx={C}
              cy={C}
              r={MIN_R + (MAX_R - MIN_R) * k}
              className="sc-orbit"
              pointerEvents="none"
            />
          ))}

          {/* piccoli pianeti/stelle decorativi che orbitano lentamente */}
          {[0.34, 0.67, 1].map((k, i) => {
            const r = MIN_R + (MAX_R - MIN_R) * k;
            return (
              <g
                key={`spin-${k}`}
                className="sc-spin"
                pointerEvents="none"
                style={{
                  animationDuration: `${26 + i * 14}s`,
                  animationDirection: i % 2 ? "reverse" : "normal",
                }}
              >
                {[0, 120, 240].map((deg, j) => {
                  const a = ((deg + i * 37) * Math.PI) / 180;
                  return (
                    <circle
                      key={deg}
                      cx={C + Math.cos(a) * r}
                      cy={C + Math.sin(a) * r}
                      r={j === 0 ? 1.5 : 1}
                      className="sc-orbit-dot"
                      opacity={0.35 + j * 0.15}
                    />
                  );
                })}
              </g>
            );
          })}


          {/* master sun */}
          <circle cx={C} cy={C} r={SUN_R * 2.2} fill="url(#sc-sun)" pointerEvents="none" />
          <circle
            cx={C}
            cy={C}
            r={SUN_R}
            className={`sc-sun ${selected?.kind === "master" ? "sc-sun-on" : ""}`}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              const { x, y } = toSvg(e.clientX, e.clientY);
              movedRef.current = false;
              dragRef.current = { kind: "master", sx: x, sy: y };
            }}
            onClick={() => {
              if (!movedRef.current) {
                setAnchor({ kind: "master" });
                setSelected({ kind: "master" });
                setPicker(null);
              }
              movedRef.current = false;
              dragRef.current = null;
            }}
          />
          <text x={C} y={C + 4} className="sc-sun-label" textAnchor="middle" pointerEvents="none">
            MASTER
          </text>

          {/* instrument planets */}
          {geometry.map(({ layer, x, y, rgb }) => {
            const on = selected?.kind === "layer" && selected.id === layer.id;
            return (
              <g key={layer.id}>
                <line
                  x1={C}
                  y1={C}
                  x2={x}
                  y2={y}
                  stroke={`rgba(${rgb},${0.25 + layer.gain * 0.5})`}
                  strokeWidth={1}
                  pointerEvents="none"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={24}
                  fill="transparent"
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    const { x: sx, y: sy } = toSvg(e.clientX, e.clientY);
                    movedRef.current = false;
                    dragRef.current = { kind: "layer", layerId: layer.id, sx, sy };
                  }}
                  onClick={() => {
                    if (!movedRef.current) {
                      setAnchor({ kind: "layer", id: layer.id });
                      setSelected({ kind: "layer", id: layer.id });
                      setPicker(null);
                    }
                    movedRef.current = false;
                    dragRef.current = null;
                  }}
                />
                {/* selected glow ring */}
                {on && (
                  <circle
                    cx={x}
                    cy={y}
                    r={22}
                    fill={`rgba(${rgb},0.08)`}
                    stroke={`rgba(${rgb},0.9)`}
                    strokeWidth={1.6}
                    pointerEvents="none"
                    style={{ filter: `drop-shadow(0 0 10px rgba(${rgb},0.75))` }}
                  />
                )}
                {/* alone radiante: più il volume è alto, più respira luminoso */}
                <circle
                  cx={x}
                  cy={y}
                  r={20 + layer.gain * 8}
                  fill={`rgba(${rgb},${0.05 + layer.gain * 0.16})`}
                  pointerEvents="none"
                  className="sc-radiate"
                  style={{
                    animationDuration: `${(4.4 - layer.gain * 2.4).toFixed(2)}s`,
                    filter: `drop-shadow(0 0 ${4 + layer.gain * 16}px rgba(${rgb},${0.35 + layer.gain * 0.55}))`,
                  }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={16}
                  fill={`rgba(${rgb},${0.14 + layer.gain * 0.34})`}
                  stroke={`rgba(${rgb},${on ? 0.95 : 0.5 + layer.gain * 0.5})`}
                  strokeWidth={on ? 2.4 : 1}
                  pointerEvents="none"
                />

                {/* ✕ di eliminazione, visibile solo sul nodo selezionato */}
                {on && layers.length > 1 && (
                  <g
                    className="sc-kill"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDel({ kind: "layer", id: layer.id });
                    }}
                  >
                    <circle cx={x + 17} cy={y - 17} r={8} className="sc-kill-bg" />
                    <text x={x + 17} y={y - 14} textAnchor="middle" className="sc-kill-x">
                      ✕
                    </text>
                  </g>
                )}


                <text
                  x={x}
                  y={Math.max(12, y - 23)}
                  className="sc-label"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {instrumentName(layer.instrument).toUpperCase()}
                </text>
                <text
                  x={x}
                  y={Math.min(VIEW - 4, y + 31)}
                  className="sc-value"
                  textAnchor="middle"
                  pointerEvents="none"
                >
                  {Math.round(layer.gain * 100)}%
                </text>
              </g>
            );
          })}

          {/* FX moons of the anchor node */}
          {anchorGeo &&
            fxList.map((fx, i) => {
              const def = fxDef(fx.type);
              const baseDeg = ((anchorGeo.angle ?? 0) * 180) / Math.PI + 120 + i * 50;
              const a = (baseDeg * Math.PI) / 180;
              const r = FX_MIN + (FX_MAX - FX_MIN) * clamp01(fx.amount);
              const x = anchorGeo.x + Math.cos(a) * r;
              const y = anchorGeo.y + Math.sin(a) * r;
              const on = selected?.kind === "fx" && selected.id === fx.id;
              return (
                <g key={fx.id}>
                  <line
                    x1={anchorGeo.x}
                    y1={anchorGeo.y}
                    x2={x}
                    y2={y}
                    stroke={`rgba(${def.rgb},0.45)`}
                    strokeWidth={0.8}
                    strokeDasharray="3 3"
                    pointerEvents="none"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={17}
                    fill="transparent"
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      const { x: sx, y: sy } = toSvg(e.clientX, e.clientY);
                      movedRef.current = false;
                      dragRef.current = {
                        kind: "fx",
                        layerId: fxParentId,
                        fxId: fx.id,
                        ox: anchorGeo.x,
                        oy: anchorGeo.y,
                        sx,
                        sy,
                      };
                    }}
                    onClick={() => {
                      if (!movedRef.current) {
                        setSelected({ kind: "fx", id: fx.id });
                        setPicker(null);
                      }
                      movedRef.current = false;
                      dragRef.current = null;
                    }}
                  />
                  {/* selected glow ring */}
                  {on && (
                    <circle
                      cx={x}
                      cy={y}
                      r={11}
                      fill={`rgba(${def.rgb},0.12)`}
                      stroke={`rgba(${def.rgb},0.95)`}
                      strokeWidth={1.4}
                      pointerEvents="none"
                      style={{ filter: `drop-shadow(0 0 8px rgba(${def.rgb},0.8))` }}
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={10 + fx.amount * 4}
                    fill={`rgba(${def.rgb},${0.06 + fx.amount * 0.14})`}
                    pointerEvents="none"
                    className="sc-radiate"
                    style={{
                      animationDuration: `${(4.2 - fx.amount * 2.3).toFixed(2)}s`,
                      filter: `drop-shadow(0 0 ${3 + fx.amount * 12}px rgba(${def.rgb},${0.3 + fx.amount * 0.6}))`,
                    }}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={7}
                    fill={`rgba(${def.rgb},${0.3 + fx.amount * 0.6})`}
                    stroke={`rgba(${def.rgb},${on ? 1 : 0.95})`}
                    strokeWidth={on ? 2 : 0.8}
                    pointerEvents="none"
                  />
                  {on && (
                    <g
                      className="sc-kill"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDel({ kind: "fx", id: fx.id });
                      }}
                    >
                      <circle cx={x + 12} cy={y - 12} r={7} className="sc-kill-bg" />
                      <text x={x + 12} y={y - 9} textAnchor="middle" className="sc-kill-x">
                        ✕
                      </text>
                    </g>
                  )}

                  <text
                    x={x}
                    y={Math.max(10, y - 13)}
                    className="sc-fx-label"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {def.label.toUpperCase()} {Math.round(fx.amount * 100)}
                  </text>
                </g>
              );
            })}
        </svg>

        {/* ————— i due tasti + ————— */}
        <div className="sc-fabs">
          {!masterOnly && (
            <button
              className="sc-fab"
              disabled={layers.length >= MAX_LAYERS}
              aria-label="Aggiungi suono"
              onClick={() => {
                setPresetsOpen(false);
                setSelected(null);
                setPicker(picker === "sound" ? null : "sound");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <Sparkles className="h-3.5 w-3.5" />
              <span>SUONO</span>
            </button>
          )}
          <button
            className="sc-fab"
            disabled={fxList.length >= 4}
            aria-label="Aggiungi effetto"
            onClick={() => {
              setPresetsOpen(false);
              setSelected(null);
              setPicker(picker === "fx" ? null : "fx");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <Wand2 className="h-3.5 w-3.5" />
            <span>FX</span>
          </button>
        </div>

        {/* ————— picker: nuovo suono / nuovo effetto ————— */}
        {picker && (
          <div className="sc-pop">
            <div className="sc-pop-head">
              <span>{picker === "sound" ? "NUOVO SUONO" : "NUOVO EFFETTO"}</span>
              <button aria-label="Chiudi" className="sc-pop-x" onClick={() => setPicker(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="sc-pop-grid">
              {picker === "sound"
                ? INSTRUMENTS.map((it) => (
                    <button
                      key={it.id}
                      className="sc-chip"
                      onClick={() => {
                        const updated = addLayer(state, it.id as InstrumentId);
                        onChange(updated);
                        const newId = updated.instruments[updated.instruments.length - 1]!.id;
                        setAnchor({ kind: "layer", id: newId });
                        setSelected({ kind: "layer", id: newId });
                        setPicker(null);
                      }}
                    >
                      {it.name}
                    </button>
                  ))
                : FX_CATALOG.map((def) => (
                    <button
                      key={def.type}
                      className="sc-chip"
                      onClick={() => {
                        const updated = addFx(state, fxParentId, def.type as FxTypeId);
                        onChange(updated);
                        const list = fxListOf(updated, fxParentId);
                        const newFx = list[list.length - 1];
                        if (newFx) setSelected({ kind: "fx", id: newFx.id });
                        setPicker(null);
                      }}
                    >
                      {def.label}
                    </button>
                  ))}
            </div>
            <p className="sc-hint">
              {picker === "sound"
                ? `${layers.length}/${MAX_LAYERS} strumenti nella costellazione`
                : `Effetti su ${anchorLayer ? instrumentName(anchorLayer.instrument) : "Master"} · ${fxList.length}/4`}
            </p>
          </div>
        )}
      </div>

      <p className="sc-hint">
        Tocca un nodo per selezionarlo e aprire i parametri · trascina per regolare volume o quantità.
      </p>

      {legatoMs != null && onLegatoChange && (
        <label className="mt-2 block text-[11px] font-semibold">
          Legato fra accordi: <b>{legatoMs} ms</b>
          <input
            type="range"
            min={0}
            max={600}
            step={10}
            value={legatoMs}
            onChange={(e) => onLegatoChange(Number(e.target.value))}
            className="sc-range"
            aria-label="Velocità legato fra accordi"
          />
        </label>
      )}


      {/* ————— libreria preset: finestra a parte (icona salva in alto) ————— */}
      {presetsOpen && (
        <div className="sc-dock sc-dock-presets" role="dialog" aria-label="Preset">
          <div className="sc-pop-head">
            <span>
              PRESET · {presets.length}/{MAX_PRESETS}
            </span>
            <button
              className="sc-pop-x"
              aria-label="Chiudi preset"
              onClick={() => setPresetsOpen(false)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <label className="sc-field-label">
            Cosa salvare
            <select
              className="sc-field"
              aria-label="Contenuto del preset"
              value={presetTarget}
              onChange={(e) => setPresetTarget(e.target.value)}
            >
              <option value="console">Console completa (tutti i suoni + FX)</option>
              <option value="">
                Solo catena FX ({anchorLayer ? instrumentName(anchorLayer.instrument) : "Master"})
              </option>
              {!masterOnly &&
                layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    Solo strumento · {instrumentName(l.instrument)}
                  </option>
                ))}
            </select>
          </label>

          <div className="flex gap-1.5">
            <input
              className="sc-field flex-1"
              placeholder={
                presetTarget === "console"
                  ? "Nome preset console"
                  : presetTarget
                    ? "Nome preset strumento"
                    : "Nome preset effetti"
              }
              aria-label="Nome del preset"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <button className="sc-chip sc-chip-on" onClick={saveCurrentPreset}>
              <Save className="h-3.5 w-3.5" /> Salva
            </button>
          </div>

          <div className="sc-field-label">Preset di fabbrica</div>
          <div className="flex flex-col gap-1.5">
            {FACTORY_PRESETS.map((p) => (
              <button
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
                onClick={() => {
                  onChange(p.build());
                  setPresetsOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{p.name}</span>
                <span className="shrink-0 text-[10px] opacity-60">{p.hint}</span>
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <button className="sc-chip flex-1" onClick={() => fileRef.current?.click()}>
              Importa preset
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Importa un preset da file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const next = await importPresetFile(file);
                if (next) setPresets(next);
              }}
            />
          </div>

          {presets.length === 0 ? (
            <p className="sc-hint">
              Nessun preset salvato. Salva la console completa per riusarla anche in altri progetti.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold">
                    {p.name}
                    <span className="ml-2 opacity-60">
                      {p.kind === "console"
                        ? `console · ${p.mix.instruments.length} suoni`
                        : p.kind === "layer"
                          ? "strumento"
                          : `${p.effects.length} fx`}
                    </span>
                  </span>
                  <button
                    className="sc-chip"
                    disabled={p.kind === "layer" && (masterOnly || layers.length >= MAX_LAYERS)}
                    onClick={() => {
                      if (p.kind === "console") {
                        const next = cloneMix(p.mix);
                        onChange(next);
                        const first = next.instruments[0];
                        setAnchor(
                          masterOnly || !first
                            ? { kind: "master" }
                            : { kind: "layer", id: first.id },
                        );
                        setSelected(null);
                      } else if (p.kind === "layer") {
                        const updated = insertLayer(state, p.layer);
                        onChange(updated);
                        const added = updated.instruments[updated.instruments.length - 1];
                        if (added) setAnchor({ kind: "layer", id: added.id });
                      } else {
                        onChange(replaceFxChain(state, fxParentId, p.effects));
                      }
                      setPresetsOpen(false);
                    }}
                  >
                    Apri
                  </button>
                  <button
                    className="sc-chip"
                    aria-label={`Esporta preset ${p.name}`}
                    onClick={() => exportPresetFile(p)}
                  >
                    Esporta
                  </button>
                  <button
                    className="sc-danger"
                    aria-label={`Elimina preset ${p.name}`}
                    onClick={() => setPresets(deletePreset(p.id))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      )}


      {/* ————— controllo con le mani (disattivato di default) ————— */}
      {handControl && onHandControlChange && (
        <div className="sc-editor mt-2">
          <div className="sc-pop-head">
            <span>CONTROLLO MANI</span>
            <button
              className="sc-chip"
              onClick={() =>
                onHandControlChange({ cutoff: "off", volume: "off", reverb: "off" })
              }
            >
              Azzera
            </button>
          </div>
          {HAND_TARGETS.map((t) => (
            <label key={t.id} className="sc-field-label">
              {t.label}
              <select
                className="sc-field"
                aria-label={`Controllo mani per ${t.label}`}
                value={handControl[t.id as HandTargetId]}
                onChange={(e) =>
                  onHandControlChange({
                    ...handControl,
                    [t.id]: e.target.value as HandSource,
                  })
                }
              >
                {HAND_SOURCES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <p className="sc-hint">
            Di default nessun parametro segue le mani: attiva qui quello che vuoi suonare col
            gesto.
          </p>
        </div>
      )}


      {/* ————— pannello parametri: finestra laterale, non copre la console ————— */}
      {selected && (
        <div className="sc-dock" role="dialog" aria-label="Parametri">

          <div className="sc-pop-head">
            <span>
              {selected.kind === "master"
                ? "MASTER"
                : selected.kind === "layer"
                  ? instrumentName(
                      layers.find((l) => l.id === selected.id)?.instrument ?? "piano",
                    ).toUpperCase()
                  : fxDef(selectedFxInfo?.fx?.type ?? "reverb").label.toUpperCase()}
            </span>
            <button
              aria-label="Chiudi editor"
              className="sc-pop-x"
              onClick={() => setSelected(null)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {selected.kind === "master" && (
            <div className="flex flex-col gap-2">
              {masterFxList.length === 0 && (
                <p className="sc-hint">Nessun effetto sul Master. Tocca + FX per aggiungerne uno.</p>
              )}
              {masterFxList.map((fx) => (
                <div
                  key={fx.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <button
                    className="text-left text-xs font-semibold"
                    onClick={() => setSelected({ kind: "fx", id: fx.id })}
                  >
                    {fxDef(fx.type).label} · {Math.round(fx.amount * 100)}%
                  </button>
                  <button
                    className="sc-danger"
                    aria-label={`Rimuovi ${fxDef(fx.type).label}`}
                    onClick={() => setConfirmDel({ kind: "fx", id: fx.id })}
                  >
                    ✕
                  </button>

                </div>
              ))}
            </div>
          )}

          {selected.kind === "layer" && (
            <>
              {(() => {
                const editingLayer = layers.find((l) => l.id === selected.id);
                if (!editingLayer) return null;
                return (
                  <>
                    <label className="sc-field-label">
                      Strumento
                      <select
                        className="sc-field"
                        aria-label="Strumento del nodo"
                        value={editingLayer.instrument}
                        onChange={(e) =>
                          onChange(
                            patchLayer(state, editingLayer.id, {
                              instrument: e.target.value as InstrumentId,
                            }),
                          )
                        }
                      >
                        {INSTRUMENTS.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="sc-knobs">
                      <Knob
                        label="Volume"
                        value={editingLayer.gain}
                        display={`${Math.round(editingLayer.gain * 100)}%`}
                        onChange={(t) =>
                          onChange(
                            patchLayer(state, editingLayer.id, { gain: Number(t.toFixed(2)) }),
                          )
                        }
                        size={70}
                      />
                    </div>
                    <label className="sc-field-label">
                      Volume (slider)
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(editingLayer.gain * 100)}
                        aria-label="Volume dello strumento"
                        onChange={(e) =>
                          onChange(
                            patchLayer(state, editingLayer.id, {
                              gain: Number(e.target.value) / 100,
                            }),
                          )
                        }
                        className="sc-range"
                      />
                    </label>
                    <button
                      className="sc-add"
                      disabled={editingLayer.effects.length >= 4}
                      onClick={() => {
                        setAnchor({ kind: "layer", id: editingLayer.id });
                        setPicker("fx");
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      FX su {instrumentName(editingLayer.instrument)} ·{" "}
                      {editingLayer.effects.length}/4
                    </button>
                    <div className="flex flex-col gap-2">
                      {editingLayer.effects.length === 0 && (
                        <p className="sc-hint">
                          Nessun effetto su questo strumento. Tocca + FX per aggiungerne uno.
                        </p>
                      )}

                      {editingLayer.effects.map((fx) => (
                        <div
                          key={fx.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <button
                            className="text-left text-xs font-semibold"
                            onClick={() => setSelected({ kind: "fx", id: fx.id })}
                          >
                            {fxDef(fx.type).label} · {Math.round(fx.amount * 100)}%
                          </button>
                          <button
                            className="sc-danger"
                            aria-label={`Rimuovi ${fxDef(fx.type).label}`}
                            onClick={() => setConfirmDel({ kind: "fx", id: fx.id })}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    {layers.length > 1 && (
                      <button
                        className="sc-danger"
                        onClick={() => setConfirmDel({ kind: "layer", id: editingLayer.id })}
                      >
                        ✕ Rimuovi strumento
                      </button>
                    )}


                  </>
                );
              })()}
            </>
          )}

          {selected.kind === "fx" && selectedFxInfo && (
            <>
              <div className="flex gap-1.5">
                <button
                  className={`sc-chip ${selectedFxInfo.fx.bypass ? "" : "sc-chip-on"}`}
                  onClick={() =>
                    onChange(
                      patchFx(state, selectedFxInfo.parent, selectedFxInfo.fx.id, {
                        bypass: !selectedFxInfo.fx.bypass,
                      }),
                    )
                  }
                >
                  {selectedFxInfo.fx.bypass ? "OFF" : "ON"}
                </button>
                <button
                  className="sc-danger"
                  onClick={() => setConfirmDel({ kind: "fx", id: selectedFxInfo.fx.id })}
                >
                  ✕ Rimuovi effetto
                </button>

              </div>

              <p className="mt-1.5 text-[10px] uppercase tracking-[0.12em] opacity-70">
                {selectedFxInfo.parent === null
                  ? "Master · applicato a tutto il mix"
                  : `Solo su ${instrumentName(
                      layers.find((l) => l.id === selectedFxInfo.parent)?.instrument ?? "piano",
                    )}`}
              </p>

              {selectedFxInfo.fx.type === "gate" && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {GATE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        onChange(
                          patchFx(state, selectedFxInfo.parent, selectedFxInfo.fx.id, {
                            preset: p.id,
                          }),
                        )
                      }
                      className={`sc-preset ${selectedFxInfo.fx.preset === p.id ? "sc-chip-on" : ""}`}
                    >
                      <span className="block text-[11px] font-bold">{p.name}</span>
                      <span className="block font-mono text-[10px] opacity-70">
                        {gateGlyph(p.id as GatePresetId)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="sc-knobs mt-2">
                <Knob
                  label="Quantità"
                  value={selectedFxInfo.fx.amount}
                  display={`${Math.round(selectedFxInfo.fx.amount * 100)}%`}
                  onChange={(t) =>
                    onChange(
                      patchFx(state, selectedFxInfo.parent, selectedFxInfo.fx.id, {
                        amount: Number(t.toFixed(2)),
                      }),
                    )
                  }
                  size={70}
                />
                {fxDef(selectedFxInfo.fx.type).params.map((def) => {
                  const value = selectedFxInfo.fx.params[def.id] ?? def.default;
                  return (
                    <Knob
                      key={def.id}
                      label={def.label}
                      value={normParam(def, value)}
                      display={formatParam(def, value)}
                      onChange={(t) => {
                        const next = def.toggle ? (t > 0.5 ? 1 : 0) : denormParam(def, t);
                        onChange(
                          setFxParam(
                            state,
                            selectedFxInfo.parent,
                            selectedFxInfo.fx.id,
                            def.id,
                            next,
                          ),
                        );
                      }}
                    />
                  );
                })}
              </div>

              <label className="sc-field-label">
                Quantità (slider)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedFxInfo.fx.amount * 100)}
                  aria-label="Quantità effetto"
                  onChange={(e) =>
                    onChange(
                      patchFx(state, selectedFxInfo.parent, selectedFxInfo.fx.id, {
                        amount: Number(e.target.value) / 100,
                      }),
                    )
                  }
                  className="sc-range"
                />
              </label>

            </>
          )}
        </div>
      )}
    </div>
  );
}
