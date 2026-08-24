/**
 * SOUND CONSTELLATION — one screen for instruments (up to 4) and their FX.
 *
 * The MASTER node is the sun at the centre. Each instrument is a planet: its
 * DISTANCE from the sun is its level in the mix. Selecting a node reveals its
 * effects as moons; a moon's distance from its planet is the effect amount.
 *
 * Purely presentational: it edits an immutable `MixState` through `onChange`,
 * so the audio engine stays the only owner of the DSP graph.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  if (def.unit === "Hz") return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
  if (def.unit === "s") return `${Math.round(value * 1000)} ms`;
  if (def.unit === "×") return `${value.toFixed(2)}×`;
  return value >= 10 ? value.toFixed(0) : value.toFixed(2);
}

type Drag =
  | { kind: "layer"; layerId: string }
  | { kind: "fx"; layerId: string | null; fxId: string; ox: number; oy: number };

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

  const layers = state.instruments;
  const selectedLayer = layers.find((l) => l.id === selected) ?? null;
  const fxList = fxListOf(state, selectedLayer ? selectedLayer.id : null);
  const activeFx = fxList.find((f) => f.id === selectedFx) ?? null;

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

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const { x, y } = toSvg(e.clientX, e.clientY);
      if (drag.kind === "layer") {
        const dist = Math.hypot(x - C, y - C);
        const gain = clamp01((dist - MIN_R) / (MAX_R - MIN_R));
        onChange(patchLayer(state, drag.layerId, { gain: Number(gain.toFixed(3)) }));
        return;
      }
      const dist = Math.hypot(x - drag.ox, y - drag.oy);
      const amount = clamp01((dist - FX_MIN) / (FX_MAX - FX_MIN));
      onChange(patchFx(state, drag.layerId, drag.fxId, { amount: Number(amount.toFixed(3)) }));
    },
    [onChange, state, toSvg],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const anchor = selectedLayer
    ? geometry.find((g) => g.layer.id === selectedLayer.id)
    : { x: C, y: C, angle: 0, rgb: "255, 236, 190", layer: null };

  const dark = tone === "dark";

  return (
    <div className={`sc ${dark ? "sc-dark" : "sc-light"}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="w-full touch-none select-none"
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
          }}
        />
        <text x={C} y={C + 4} className="sc-sun-label" textAnchor="middle" pointerEvents="none">
          MASTER
        </text>

        {/* instrument planets */}
        {geometry.map(({ layer, x, y, rgb }) => {
          const on = selected === layer.id;
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
                  dragRef.current = { kind: "layer", layerId: layer.id };
                }}
              />
              <circle
                cx={x}
                cy={y}
                r={16}
                fill={`rgba(${rgb},${0.14 + layer.gain * 0.34})`}
                stroke={`rgba(${rgb},${0.5 + layer.gain * 0.5})`}
                strokeWidth={on ? 2 : 1}
                pointerEvents="none"
                style={{ filter: `drop-shadow(0 0 ${3 + layer.gain * 12}px rgba(${rgb},0.7))` }}
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
                    dragRef.current = {
                      kind: "fx",
                      layerId: selectedLayer ? selectedLayer.id : null,
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
              </g>
            );
          })}
      </svg>

      <p className="sc-hint">
        Trascina uno strumento: lontano dal sole = più volume. Tocca un nodo per aprire i suoi
        effetti, poi trascina le lune per regolarne la quantità.
      </p>

      {/* ————— pannello del nodo selezionato ————— */}
      <div className="sc-panel">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          {selectedLayer ? (
            <label className="sc-field-label">
              Strumento
              <select
                className="sc-field"
                aria-label="Strumento del nodo"
                value={selectedLayer.instrument}
                onChange={(e) =>
                  onChange(
                    patchLayer(state, selectedLayer.id, {
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
          ) : (
            <p className="sc-field-label">Master bus · effetti su tutto il mix</p>
          )}
          {selectedLayer && layers.length > 1 && (
            <button
              className="sc-btn"
              aria-label="Rimuovi strumento"
              onClick={() => {
                onChange(removeLayer(state, selectedLayer.id));
                setSelected(layers.find((l) => l.id !== selectedLayer.id)?.id ?? null);
                setSelectedFx(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {selectedLayer && (
          <label className="sc-field-label">
            Volume: <b>{Math.round(selectedLayer.gain * 100)}%</b>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(selectedLayer.gain * 100)}
              aria-label="Volume dello strumento"
              onChange={(e) =>
                onChange(patchLayer(state, selectedLayer.id, { gain: Number(e.target.value) / 100 }))
              }
              className="sc-range"
            />
          </label>
        )}

        {layers.length < MAX_LAYERS && (
          <button
            className="sc-add"
            onClick={() => {
              const used = layers.map((l) => l.instrument);
              const next =
                (INSTRUMENTS.find((i) => !used.includes(i.id))?.id as InstrumentId | undefined) ??
                layers[0]!.instrument;
              const updated = addLayer(state, next);
              onChange(updated);
              setSelected(updated.instruments[updated.instruments.length - 1]!.id);
              setSelectedFx(null);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Aggiungi strumento ({layers.length}/{MAX_LAYERS})
          </button>
        )}

        <div className="sc-sub">
          <p className="sc-sub-title">
            Effetti di {selectedLayer ? instrumentName(selectedLayer.instrument) : "Master"} (
            {fxList.length}/4)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FX_CATALOG.map((def) => (
              <button
                key={def.type}
                className="sc-chip"
                disabled={fxList.length >= 4}
                onClick={() => {
                  const layerId = selectedLayer ? selectedLayer.id : null;
                  const updated = addFx(state, layerId, def.type as FxTypeId);
                  onChange(updated);
                  const list = fxListOf(updated, layerId);
                  setSelectedFx(list[list.length - 1]?.id ?? null);
                }}
              >
                <Plus className="mr-1 inline h-3 w-3" />
                {def.label}
              </button>
            ))}
          </div>
        </div>

        {fxList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {fxList.map((fx) => (
              <button
                key={fx.id}
                onClick={() => setSelectedFx(fx.id)}
                className={`sc-chip ${selectedFx === fx.id ? "sc-chip-on" : ""}`}
              >
                {fxDef(fx.type).label} · {Math.round(fx.amount * 100)}%
              </button>
            ))}
          </div>
        )}

        {activeFx && (
          <div className="sc-sub">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <p className="sc-sub-title truncate">{fxDef(activeFx.type).label}</p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  className={`sc-chip ${activeFx.bypass ? "" : "sc-chip-on"}`}
                  onClick={() => {
                    const layerId = selectedLayer ? selectedLayer.id : null;
                    onChange(patchFx(state, layerId, activeFx.id, { bypass: !activeFx.bypass }));
                  }}
                >
                  {activeFx.bypass ? "OFF" : "ON"}
                </button>
                <button
                  className="sc-btn"
                  aria-label="Rimuovi effetto"
                  onClick={() => {
                    const layerId = selectedLayer ? selectedLayer.id : null;
                    onChange(removeFx(state, layerId, activeFx.id));
                    setSelectedFx(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {activeFx.type === "gate" && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {GATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      const layerId = selectedLayer ? selectedLayer.id : null;
                      onChange(patchFx(state, layerId, activeFx.id, { preset: p.id }));
                    }}
                    className={`sc-preset ${activeFx.preset === p.id ? "sc-chip-on" : ""}`}
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
              Quantità: <b>{Math.round(activeFx.amount * 100)}%</b>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(activeFx.amount * 100)}
                aria-label="Quantità effetto"
                onChange={(e) => {
                  const layerId = selectedLayer ? selectedLayer.id : null;
                  onChange(
                    patchFx(state, layerId, activeFx.id, {
                      amount: Number(e.target.value) / 100,
                    }),
                  );
                }}
                className="sc-range"
              />
            </label>

            {fxDef(activeFx.type).params.map((def) => {
              const value = activeFx.params[def.id] ?? def.default;
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
                      const layerId = selectedLayer ? selectedLayer.id : null;
                      const next = def.toggle
                        ? Number(e.target.value) > 500
                          ? 1
                          : 0
                        : denormParam(def, Number(e.target.value) / 1000);
                      onChange(setFxParam(state, layerId, activeFx.id, def.id, next));
                    }}
                    className="sc-range"
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
