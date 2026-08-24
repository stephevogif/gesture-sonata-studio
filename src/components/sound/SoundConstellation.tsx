/**
 * SOUND CONSTELLATION — one screen for instruments (up to 4) and their FX.
 *
 * The MASTER node is the sun at the centre. Each instrument is a planet: its
 * DISTANCE from the sun is its level in the mix. Selecting a node reveals its
 * effects as moons; a moon's distance from its planet is the effect amount.
 *
 * Interaction (all on the constellation itself, no side panels):
 *   • drag           → volume (planet) / amount (moon)
 *   • two + buttons  → add sound · add FX to the selected node
 *   • double tap     → arms a red X badge on that node, tap it to delete
 *   • press & hold   → opens the editor sheet for that sound or effect
 *
 * Purely presentational: it edits an immutable `MixState` through `onChange`,
 * so the audio engine stays the only owner of the DSP graph.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Sparkles, Wand2, X } from "lucide-react";
import { FX_CATALOG, fxDef, type FxParamDef } from "@/core/audio/fxCatalog";
import { GATE_PRESETS, gateGlyph, type GatePresetId } from "@/core/audio/gatePresets";
import type { FxTypeId } from "@/core/audio/fx";
import { INSTRUMENTS, type InstrumentId } from "@/core/audio/presets";
import {
  MAX_LAYERS,
  addFx,
  addLayer,
  fxListOf,
  patchFx,
  patchLayer,
  removeFx,
  removeLayer,
  setFxParam,
  type MixState,
} from "@/core/sound/mix";

const VIEW = 320;
const C = VIEW / 2;
const SUN_R = 30;
const MIN_R = 52;
const MAX_R = 122;
const FX_MIN = 24;
const FX_MAX = 54;
const HOLD_MS = 480;
const DOUBLE_MS = 320;

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
  | { kind: "layer"; layerId: string }
  | { kind: "fx"; layerId: string | null; fxId: string; ox: number; oy: number };

/** node identity used by delete-arming and the hold editor */
type NodeRef = { kind: "layer"; id: string } | { kind: "fx"; id: string };

const sameNode = (a: NodeRef | null, b: NodeRef) => !!a && a.kind === b.kind && a.id === b.id;

type Props = {
  state: MixState;
  onChange: (next: MixState) => void;
  tone?: "light" | "dark";
};

export default function SoundConstellation({ state, onChange, tone = "light" }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  /** null = master bus selected */
  const [selected, setSelected] = useState<string | null>(state.instruments[0]?.id ?? null);
  const [selectedFx, setSelectedFx] = useState<string | null>(null);
  /** node armed for deletion (red X visible) */
  const [armed, setArmed] = useState<NodeRef | null>(null);
  /** node opened by press & hold */
  const [editing, setEditing] = useState<NodeRef | null>(null);
  /** picker overlays driven by the two + buttons */
  const [picker, setPicker] = useState<"sound" | "fx" | null>(null);

  const layers = state.instruments;
  const selectedLayer = layers.find((l) => l.id === selected) ?? null;
  const fxList = fxListOf(state, selectedLayer ? selectedLayer.id : null);
  const activeFx = fxList.find((f) => f.id === selectedFx) ?? null;
  const editingLayer =
    editing?.kind === "layer" ? (layers.find((l) => l.id === editing.id) ?? null) : null;
  const editingFx = editing?.kind === "fx" ? (fxList.find((f) => f.id === editing.id) ?? null) : null;
  const targetLayerId = selectedLayer ? selectedLayer.id : null;

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

  /**
   * Dragging is coalesced into one update per animation frame: pointermove can
   * fire far faster than the display, and every update reconciles React plus
   * the audio graph. `stateRef` keeps the frame callback on the latest mix.
   */
  const stateRef = useRef(state);
  stateRef.current = state;
  const frameRef = useRef(0);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const holdRef = useRef(0);
  const movedRef = useRef(false);
  const lastTapRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  const clearHold = useCallback(() => {
    if (holdRef.current) {
      window.clearTimeout(holdRef.current);
      holdRef.current = 0;
    }
  }, []);

  /** shared gesture bookkeeping for every draggable node */
  const beginGesture = useCallback(
    (node: NodeRef) => {
      movedRef.current = false;
      clearHold();
      holdRef.current = window.setTimeout(() => {
        if (movedRef.current) return;
        dragRef.current = null;
        setArmed(null);
        setEditing(node);
      }, HOLD_MS);
      const key = `${node.kind}:${node.id}`;
      const now = Date.now();
      const prev = lastTapRef.current;
      if (prev.key === key && now - prev.at < DOUBLE_MS) {
        clearHold();
        dragRef.current = null;
        setArmed((a) => (sameNode(a, node) ? null : node));
        lastTapRef.current = { key: "", at: 0 };
        return false;
      }
      lastTapRef.current = { key, at: now };
      return true;
    },
    [clearHold],
  );

  const applyPending = useCallback(() => {
    frameRef.current = 0;
    const drag = dragRef.current;
    const point = pendingRef.current;
    pendingRef.current = null;
    if (!drag || !point) return;
    const current = stateRef.current;
    if (drag.kind === "layer") {
      const dist = Math.hypot(point.x - C, point.y - C);
      const gain = clamp01((dist - MIN_R) / (MAX_R - MIN_R));
      const layer = current.instruments.find((l) => l.id === drag.layerId);
      const next = Number(gain.toFixed(2));
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
      if (!dragRef.current) return;
      e.preventDefault();
      movedRef.current = true;
      clearHold();
      pendingRef.current = toSvg(e.clientX, e.clientY);
      if (!frameRef.current) frameRef.current = requestAnimationFrame(applyPending);
    },
    [applyPending, clearHold, toSvg],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    pendingRef.current = null;
    clearHold();
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
  }, [clearHold]);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (holdRef.current) window.clearTimeout(holdRef.current);
    },
    [],
  );

  const deleteLayer = (id: string) => {
    onChange(removeLayer(state, id));
    setArmed(null);
    setEditing(null);
    if (selected === id) setSelected(layers.find((l) => l.id !== id)?.id ?? null);
    setSelectedFx(null);
  };

  const deleteFx = (id: string) => {
    onChange(removeFx(state, targetLayerId, id));
    setArmed(null);
    setEditing(null);
    if (selectedFx === id) setSelectedFx(null);
  };

  const anchor = selectedLayer
    ? geometry.find((g) => g.layer.id === selectedLayer.id)
    : { x: C, y: C, angle: 0, rgb: "255, 236, 190", layer: null };

  const dark = tone === "dark";

  return (
    <div className={`sc ${dark ? "sc-dark" : "sc-light"}`}>
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
            <circle key={k} cx={C} cy={C} r={MIN_R + (MAX_R - MIN_R) * k} className="sc-orbit" />
          ))}

          {/* master sun */}
          <circle cx={C} cy={C} r={SUN_R * 2.2} fill="url(#sc-sun)" />
          <circle
            cx={C}
            cy={C}
            r={SUN_R}
            className={`sc-sun ${selectedLayer === null ? "sc-sun-on" : ""}`}
            onClick={() => {
              setSelected(null);
              setSelectedFx(null);
              setArmed(null);
            }}
          />
          <text x={C} y={C + 4} className="sc-sun-label" textAnchor="middle" pointerEvents="none">
            MASTER
          </text>

          {/* instrument planets */}
          {geometry.map(({ layer, x, y, rgb }) => {
            const on = selected === layer.id;
            const isArmed = sameNode(armed, { kind: "layer", id: layer.id });
            return (
              <g key={layer.id}>
                <line
                  x1={C}
                  y1={C}
                  x2={x}
                  y2={y}
                  stroke={`rgba(${rgb},${0.25 + layer.gain * 0.5})`}
                  strokeWidth={1}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={24}
                  fill="transparent"
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    setSelected(layer.id);
                    setSelectedFx(null);
                    if (!beginGesture({ kind: "layer", id: layer.id })) return;
                    dragRef.current = { kind: "layer", layerId: layer.id };
                  }}
                />
                {/* halo drawn as a plain circle: SVG filters re-rasterise on every
                    drag frame and stall low-end phones */}
                <circle
                  cx={x}
                  cy={y}
                  r={20 + layer.gain * 6}
                  fill={`rgba(${rgb},${0.05 + layer.gain * 0.12})`}
                  pointerEvents="none"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={16}
                  fill={`rgba(${rgb},${0.14 + layer.gain * 0.34})`}
                  stroke={`rgba(${rgb},${0.5 + layer.gain * 0.5})`}
                  strokeWidth={on ? 2 : 1}
                  pointerEvents="none"
                />

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

                {isArmed && layers.length > 1 && (
                  <g
                    className="sc-kill"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      deleteLayer(layer.id);
                    }}
                  >
                    <circle cx={x + 17} cy={y - 17} r={9} className="sc-kill-bg" />
                    <text x={x + 17} y={y - 13.5} className="sc-kill-x" textAnchor="middle">
                      ✕
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* FX moons of the selected node */}
          {anchor &&
            fxList.map((fx, i) => {
              const def = fxDef(fx.type);
              const base = (anchor.angle ?? 0) + 120 + i * 50;
              const a = (base * Math.PI) / 180;
              const r = FX_MIN + (FX_MAX - FX_MIN) * clamp01(fx.amount);
              const x = anchor.x + Math.cos(a) * r;
              const y = anchor.y + Math.sin(a) * r;
              const on = selectedFx === fx.id;
              const isArmed = sameNode(armed, { kind: "fx", id: fx.id });
              return (
                <g key={fx.id}>
                  <line
                    x1={anchor.x}
                    y1={anchor.y}
                    x2={x}
                    y2={y}
                    stroke={`rgba(${def.rgb},0.45)`}
                    strokeWidth={0.8}
                    strokeDasharray="3 3"
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
                      setSelectedFx(fx.id);
                      if (!beginGesture({ kind: "fx", id: fx.id })) return;
                      dragRef.current = {
                        kind: "fx",
                        layerId: targetLayerId,
                        fxId: fx.id,
                        ox: anchor.x,
                        oy: anchor.y,
                      };
                    }}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={7}
                    fill={`rgba(${def.rgb},${0.3 + fx.amount * 0.6})`}
                    stroke={`rgba(${def.rgb},0.95)`}
                    strokeWidth={on ? 1.8 : 0.8}
                    pointerEvents="none"
                  />
                  <text
                    x={x}
                    y={Math.max(10, y - 13)}
                    className="sc-fx-label"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {def.label.toUpperCase()} {Math.round(fx.amount * 100)}
                  </text>

                  {isArmed && (
                    <g
                      className="sc-kill"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        deleteFx(fx.id);
                      }}
                    >
                      <circle cx={x + 11} cy={y - 11} r={8} className="sc-kill-bg" />
                      <text x={x + 11} y={y - 8} className="sc-kill-x" textAnchor="middle">
                        ✕
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
        </svg>

        {/* ————— i due tasti + ————— */}
        <div className="sc-fabs">
          <button
            className="sc-fab"
            disabled={layers.length >= MAX_LAYERS}
            aria-label="Aggiungi suono"
            onClick={() => setPicker(picker === "sound" ? null : "sound")}
          >
            <Plus className="h-3.5 w-3.5" />
            <Sparkles className="h-3.5 w-3.5" />
            <span>SUONO</span>
          </button>
          <button
            className="sc-fab"
            disabled={fxList.length >= 4}
            aria-label="Aggiungi effetto"
            onClick={() => setPicker(picker === "fx" ? null : "fx")}
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
                        setSelected(updated.instruments[updated.instruments.length - 1]!.id);
                        setSelectedFx(null);
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
                        const updated = addFx(state, targetLayerId, def.type as FxTypeId);
                        onChange(updated);
                        const list = fxListOf(updated, targetLayerId);
                        setSelectedFx(list[list.length - 1]?.id ?? null);
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
                : `Effetti su ${selectedLayer ? instrumentName(selectedLayer.instrument) : "Master"} · ${fxList.length}/4`}
            </p>
          </div>
        )}
      </div>

      <p className="sc-hint">
        Trascina un pianeta: lontano dal sole = più volume · doppio tap = ✕ rossa per cancellare ·
        tieni premuto = modifica suono o parametri dell'effetto.
      </p>

      {/* ————— editor da press & hold ————— */}
      {(editingLayer || editingFx) && (
        <div className="sc-editor">
          <div className="sc-pop-head">
            <span>
              {editingLayer
                ? instrumentName(editingLayer.instrument).toUpperCase()
                : fxDef(editingFx!.type).label.toUpperCase()}
            </span>
            <button aria-label="Chiudi editor" className="sc-pop-x" onClick={() => setEditing(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {editingLayer && (
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
              <label className="sc-field-label">
                Volume: <b>{Math.round(editingLayer.gain * 100)}%</b>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(editingLayer.gain * 100)}
                  aria-label="Volume dello strumento"
                  onChange={(e) =>
                    onChange(
                      patchLayer(state, editingLayer.id, { gain: Number(e.target.value) / 100 }),
                    )
                  }
                  className="sc-range"
                />
              </label>
              {layers.length > 1 && (
                <button className="sc-danger" onClick={() => deleteLayer(editingLayer.id)}>
                  ✕ Rimuovi strumento
                </button>
              )}
            </>
          )}

          {editingFx && (
            <>
              <div className="flex gap-1.5">
                <button
                  className={`sc-chip ${editingFx.bypass ? "" : "sc-chip-on"}`}
                  onClick={() =>
                    onChange(
                      patchFx(state, targetLayerId, editingFx.id, { bypass: !editingFx.bypass }),
                    )
                  }
                >
                  {editingFx.bypass ? "OFF" : "ON"}
                </button>
                <button className="sc-danger" onClick={() => deleteFx(editingFx.id)}>
                  ✕ Rimuovi effetto
                </button>
              </div>

              {editingFx.type === "gate" && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {GATE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        onChange(patchFx(state, targetLayerId, editingFx.id, { preset: p.id }))
                      }
                      className={`sc-preset ${editingFx.preset === p.id ? "sc-chip-on" : ""}`}
                    >
                      <span className="block text-[11px] font-bold">{p.name}</span>
                      <span className="block font-mono text-[10px] opacity-70">
                        {gateGlyph(p.id as GatePresetId)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <label className="sc-field-label mt-2">
                Quantità: <b>{Math.round(editingFx.amount * 100)}%</b>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(editingFx.amount * 100)}
                  aria-label="Quantità effetto"
                  onChange={(e) =>
                    onChange(
                      patchFx(state, targetLayerId, editingFx.id, {
                        amount: Number(e.target.value) / 100,
                      }),
                    )
                  }
                  className="sc-range"
                />
              </label>

              {fxDef(editingFx.type).params.map((def) => {
                const value = editingFx.params[def.id] ?? def.default;
                return (
                  <label key={def.id} className="sc-field-label">
                    {def.label}: <b>{formatParam(def, value)}</b>
                    <input
                      type="range"
                      min={0}
                      max={1000}
                      value={Math.round(normParam(def, value) * 1000)}
                      aria-label={def.label}
                      onChange={(e) => {
                        const next = def.toggle
                          ? Number(e.target.value) > 500
                            ? 1
                            : 0
                          : denormParam(def, Number(e.target.value) / 1000);
                        onChange(setFxParam(state, targetLayerId, editingFx.id, def.id, next));
                      }}
                      className="sc-range"
                    />
                  </label>
                );
              })}
            </>
          )}
        </div>
      )}

      {activeFx && !editing && (
        <p className="sc-hint">
          Selezionato: <b>{fxDef(activeFx.type).label}</b> · {Math.round(activeFx.amount * 100)}%
        </p>
      )}
    </div>
  );
}
