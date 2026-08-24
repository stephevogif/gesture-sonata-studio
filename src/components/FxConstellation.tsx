/**
 * FX CONSTELLATION — interfaccia effetti a costellazione.
 *
 * Il CORE (strumento) sta al centro; ogni effetto è un nodo orbitante e la sua
 * DISTANZA dal core è la quantità dell'effetto (vicino = 0%, bordo = 100%).
 * Toccando un effetto compaiono i suoi satelliti (parametri interni), a loro
 * volta trascinabili: distanza dal nodo padre = valore del parametro.
 *
 * Il componente è puramente presentazionale: ogni nodo riceve valore, range,
 * curva e `onChange`, quindi l'audio engine resta l'unica fonte di verità DSP.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type FxCurve = "lin" | "log";

export type FxParam = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  curve?: FxCurve;
  format: (value: number) => string;
  onChange: (value: number) => void;
};

export type FxNodeSpec = {
  id: string;
  label: string;
  /** tinta della famiglia di effetti, rgb "120, 170, 255" */
  rgb: string;
  /** angolo in gradi attorno al core (0 = destra, 90 = giù) */
  angle: number;
  main: FxParam;
  params?: FxParam[];
};

type Props = {
  coreLabel: string;
  nodes: FxNodeSpec[];
  /** true = fondo scuro (Night Sky), false = cielo chiaro (Seven Heavens) */
  dark?: boolean;
};

const VIEW = 320;
const CX = VIEW / 2;
const CY = VIEW / 2;
const CORE_R = 34;
const MIN_R = 44;
const MAX_R = 118;
const SAT_MIN = 26;
const SAT_MAX = 56;

const norm = (p: FxParam) => {
  const { min, max, value } = p;
  if (p.curve === "log") {
    const lo = Math.log(Math.max(1e-4, min));
    const hi = Math.log(Math.max(1e-4, max));
    return Math.min(1, Math.max(0, (Math.log(Math.max(1e-4, value)) - lo) / (hi - lo)));
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
};

const denorm = (p: FxParam, t: number) => {
  const k = Math.min(1, Math.max(0, t));
  if (p.curve === "log") {
    const lo = Math.log(Math.max(1e-4, p.min));
    const hi = Math.log(Math.max(1e-4, p.max));
    return Math.exp(lo + (hi - lo) * k);
  }
  return p.min + (p.max - p.min) * k;
};

type DragState = {
  kind: "node" | "param";
  nodeId: string;
  paramId?: string;
  ox: number;
  oy: number;
  maxR: number;
  minR: number;
  param: FxParam;
};

export default function FxConstellation({ coreLabel, nodes, dark = true }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [angles, setAngles] = useState<Record<string, number>>({});
  const [satAngles, setSatAngles] = useState<Record<string, number>>({});
  const [tip, setTip] = useState<{ x: number; y: number; label: string; value: string } | null>(
    null,
  );
  const [born, setBorn] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setBorn(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: CX, y: CY };
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
      const dx = x - drag.ox;
      const dy = y - drag.oy;
      const dist = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const t = Math.min(1, Math.max(0, (dist - drag.minR) / (drag.maxR - drag.minR)));
      const value = denorm(drag.param, t);
      drag.param.onChange(value);
      if (drag.kind === "node") setAngles((a) => ({ ...a, [drag.nodeId]: angle }));
      else setSatAngles((a) => ({ ...a, [`${drag.nodeId}:${drag.paramId}`]: angle }));
      setTip({ x, y, label: drag.param.label, value: drag.param.format(value) });
    },
    [toSvg],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setTip(null);
  }, []);

  return (
    <div className={`fxc ${dark ? "fxc-dark" : "fxc-light"}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="w-full touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        role="group"
        aria-label="FX Constellation"
      >
        <defs>
          <radialGradient id="fxc-core-glow">
            <stop offset="0%" stopColor="rgba(255,228,168,0.55)" />
            <stop offset="100%" stopColor="rgba(255,228,168,0)" />
          </radialGradient>
        </defs>

        {/* orbite di riferimento */}
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <circle
            key={k}
            cx={CX}
            cy={CY}
            r={MIN_R + (MAX_R - MIN_R) * k}
            className="fxc-orbit"
            style={{ opacity: born ? 1 : 0 }}
          />
        ))}

        {/* core */}
        <circle cx={CX} cy={CY} r={CORE_R * 2.1} fill="url(#fxc-core-glow)" />
        <circle cx={CX} cy={CY} r={CORE_R} className="fxc-core" />
        <circle cx={CX} cy={CY} r={CORE_R - 6} className="fxc-core-inner" />
        <text x={CX} y={CY + 4} className="fxc-core-label" textAnchor="middle">
          {coreLabel.toUpperCase()}
        </text>

        {nodes.map((node, i) => {
          const a = ((angles[node.id] ?? node.angle) * Math.PI) / 180;
          const r = MIN_R + (MAX_R - MIN_R) * norm(node.main);
          const x = CX + Math.cos(a) * r;
          const y = CY + Math.sin(a) * r;
          const amount = norm(node.main);
          const open = selected === node.id;
          return (
            <g
              key={node.id}
              style={{
                opacity: born ? 1 : 0,
                transition: `opacity 420ms ease ${120 + i * 110}ms`,
              }}
            >
              <line
                x1={CX}
                y1={CY}
                x2={x}
                y2={y}
                stroke={`rgba(${node.rgb},${0.25 + amount * 0.55})`}
                strokeWidth={1}
              />

              {open &&
                (node.params ?? []).map((p, pi) => {
                  const key = `${node.id}:${p.id}`;
                  const base = node.angle + 130 + pi * 55;
                  const sa = ((satAngles[key] ?? base) * Math.PI) / 180;
                  const sr = SAT_MIN + (SAT_MAX - SAT_MIN) * norm(p);
                  const sx = x + Math.cos(sa) * sr;
                  const sy = y + Math.sin(sa) * sr;
                  return (
                    <g key={p.id} className="fxc-pop">
                      <line
                        x1={x}
                        y1={y}
                        x2={sx}
                        y2={sy}
                        stroke={`rgba(${node.rgb},0.4)`}
                        strokeWidth={0.8}
                        strokeDasharray="3 3"
                      />
                      <circle
                        cx={sx}
                        cy={sy}
                        r={16}
                        fill="transparent"
                        style={{ cursor: "grab" }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          (e.target as Element).setPointerCapture?.(e.pointerId);
                          dragRef.current = {
                            kind: "param",
                            nodeId: node.id,
                            paramId: p.id,
                            ox: x,
                            oy: y,
                            minR: SAT_MIN,
                            maxR: SAT_MAX,
                            param: p,
                          };
                        }}
                      />
                      <circle
                        cx={sx}
                        cy={sy}
                        r={6}
                        fill={`rgba(${node.rgb},${0.35 + norm(p) * 0.6})`}
                        stroke={`rgba(${node.rgb},0.9)`}
                        strokeWidth={0.8}
                        pointerEvents="none"
                      />
                      <text
                        x={sx}
                        y={sy - 12}
                        className="fxc-sat-label"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        {p.label}
                      </text>
                    </g>
                  );
                })}

              {/* hit area */}
              <circle
                cx={x}
                cy={y}
                r={24}
                fill="transparent"
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  setSelected((s) => (s === node.id ? s : node.id));
                  dragRef.current = {
                    kind: "node",
                    nodeId: node.id,
                    ox: CX,
                    oy: CY,
                    minR: MIN_R,
                    maxR: MAX_R,
                    param: node.main,
                  };
                }}
                onClick={() => setSelected((s) => (s === node.id ? null : node.id))}
              />
              <circle
                cx={x}
                cy={y}
                r={15}
                fill={`rgba(${node.rgb},${0.1 + amount * 0.3})`}
                stroke={`rgba(${node.rgb},${0.5 + amount * 0.5})`}
                strokeWidth={open ? 1.8 : 1}
                pointerEvents="none"
                style={{ filter: `drop-shadow(0 0 ${2 + amount * 12}px rgba(${node.rgb},0.75))` }}
              />
              <circle
                cx={x}
                cy={y}
                r={3.2}
                fill={`rgba(${node.rgb},1)`}
                pointerEvents="none"
              />
              <text x={x} y={Math.max(12, y - 22)} className="fxc-label" textAnchor="middle" pointerEvents="none">
                {node.label}
              </text>
              <text x={x} y={Math.min(VIEW - 4, y + 30)} className="fxc-value" textAnchor="middle" pointerEvents="none">
                {node.main.format(node.main.value)}
              </text>
            </g>
          );
        })}

        {tip && (
          <g pointerEvents="none">
            <rect
              x={Math.min(VIEW - 76, Math.max(4, tip.x - 36))}
              y={Math.max(4, tip.y - 52)}
              width={72}
              height={30}
              rx={6}
              className="fxc-tip-bg"
            />
            <text
              x={Math.min(VIEW - 40, Math.max(40, tip.x))}
              y={Math.max(4, tip.y - 40)}
              className="fxc-tip-label"
              textAnchor="middle"
            >
              {tip.label}
            </text>
            <text
              x={Math.min(VIEW - 40, Math.max(40, tip.x))}
              y={Math.max(4, tip.y - 29)}
              className="fxc-tip-value"
              textAnchor="middle"
            >
              {tip.value}
            </text>
          </g>
        )}
      </svg>
      <p className="fxc-hint">
        Trascina lontano dal centro = più effetto · vicino al centro = quasi dry · tocca un nodo per
        i suoi parametri.
      </p>
    </div>
  );
}
