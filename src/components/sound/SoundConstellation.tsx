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
};

export default function SoundConstellation({ state, onChange, tone = "light" }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [anchor, setAnchor] = useState<Anchor>({
    kind: "layer",
    id: state.instruments[0]?.id ?? "",
  });
  const [selected, setSelected] = useState<NodeRef | null>({
    kind: "layer",
    id: state.instruments[0]?.id ?? "",
  });
  const [picker, setPicker] = useState<"sound" | "fx" | null>(null);

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
    const parent = selectedFxInfo?.parent ?? null;
    onChange(removeFx(state, parent, id));
    setSelected((s) => (s?.kind === "fx" && s.id === id ? null : s));
  };

  const anchorGeo = anchorLayer
    ? geometry.find((g) => g.layer.id === anchorLayer.id)
    : { x: C, y: C, angle: 0, rgb: "255, 236, 190", layer: null };

  const masterFxList = state.master;
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
            <circle
              key={k}
              cx={C}
              cy={C}
              r={MIN_R + (MAX_R - MIN_R) * k}
              className="sc-orbit"
              pointerEvents="none"
            />
          ))}

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
                {/* base halo */}
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
                  stroke={`rgba(${rgb},${on ? 0.95 : 0.5 + layer.gain * 0.5})`}
                  strokeWidth={on ? 2.4 : 1}
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
              </g>
            );
          })}

          {/* FX moons of the anchor node */}
          {anchorGeo &&
            fxList.map((fx, i) => {
              const def = fxDef(fx.type);
              const base = (anchorGeo.angle ?? 0) + 120 + i * 50;
              const a = (base * Math.PI) / 180;
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
                    r={7}
                    fill={`rgba(${def.rgb},${0.3 + fx.amount * 0.6})`}
                    stroke={`rgba(${def.rgb},${on ? 1 : 0.95})`}
                    strokeWidth={on ? 2 : 0.8}
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

      {/* ————— editor aperto con un solo tocco ————— */}
      {selected && (
        <div className="sc-editor">
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
                    onClick={() => {
                      onChange(removeFx(state, null, fx.id));
                      setSelected((s) => (s?.kind === "fx" && s.id === fx.id ? null : s));
                    }}
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
                            patchLayer(state, editingLayer.id, {
                              gain: Number(e.target.value) / 100,
                            }),
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
                <button className="sc-danger" onClick={() => deleteFx(selectedFxInfo.fx.id)}>
                  ✕ Rimuovi effetto
                </button>
              </div>

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

              <label className="sc-field-label mt-2">
                Quantità: <b>{Math.round(selectedFxInfo.fx.amount * 100)}%</b>
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

              {fxDef(selectedFxInfo.fx.type).params.map((def) => {
                const value = selectedFxInfo.fx.params[def.id] ?? def.default;
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
                        onChange(
                          setFxParam(state, selectedFxInfo.parent, selectedFxInfo.fx.id, def.id, next),
                        );
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
    </div>
  );
}
