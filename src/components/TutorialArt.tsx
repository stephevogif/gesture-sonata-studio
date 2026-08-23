type ArtId =
  | "camera"
  | "fingers"
  | "tilt"
  | "height"
  | "pinch"
  | "settings"
  | "loop"
  | "keys";

const S = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Hand({ x = 0, y = 0, up = 5 }: { x?: number; y?: number; up?: number }) {
  const fingers = [0, 1, 2, 3].map((i) => {
    const fx = 44 + i * 14;
    const extended = i < up - 1;
    return (
      <line key={i} x1={fx} y1={78} x2={fx} y2={extended ? 30 : 60} strokeWidth={7} />
    );
  });
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={36} y={74} width={64} height={34} rx={16} strokeWidth={5} />
      {fingers}
      {up >= 1 && <line x1={32} y1={82} x2={12} y2={62} strokeWidth={7} />}
    </g>
  );
}

export default function TutorialArt({ id, className = "" }: { id: ArtId; className?: string }) {
  const common = {
    viewBox: "0 0 200 130",
    className: `h-32 w-full ${className}`,
    stroke: "currentColor",
    ...S,
  };

  switch (id) {
    case "camera":
      return (
        <svg {...common}>
          <rect x={30} y={35} width={95} height={62} rx={12} strokeWidth={5} />
          <circle cx={77} cy={66} r={18} strokeWidth={5} />
          <path d="M135 52l32-14v54l-32-14z" strokeWidth={5} />
          <path d="M20 20l160 90" strokeWidth={4} opacity={0.35} />
        </svg>
      );
    case "fingers":
      return (
        <svg {...common}>
          <Hand x={-10} y={10} up={3} />
          <text x={130} y={60} fontSize={26} fontWeight={700} stroke="none" fill="currentColor">
            III
          </text>
          <text x={128} y={86} fontSize={12} stroke="none" fill="currentColor" opacity={0.7}>
            3 dita = grado
          </text>
        </svg>
      );
    case "tilt":
      return (
        <svg {...common}>
          <g transform="rotate(-18 70 80)">
            <Hand x={-15} y={10} up={5} />
          </g>
          <path d="M120 88a34 34 0 0 1 52-16" strokeWidth={4} />
          <path d="M172 72l2 14-14-4" strokeWidth={4} />
          <text x={118} y={44} fontSize={13} stroke="none" fill="currentColor">
            maggiore / minore
          </text>
        </svg>
      );
    case "height":
      return (
        <svg {...common}>
          <line x1={26} y1={16} x2={26} y2={116} strokeWidth={4} opacity={0.4} />
          <path d="M26 22l-7 10h14z" strokeWidth={3} />
          <Hand x={30} y={-8} up={5} />
          <text x={150} y={40} fontSize={13} stroke="none" fill="currentColor">
            forte
          </text>
          <text x={150} y={112} fontSize={13} stroke="none" fill="currentColor" opacity={0.6}>
            piano
          </text>
        </svg>
      );
    case "pinch":
      return (
        <svg {...common}>
          <path d="M60 100V52" strokeWidth={7} />
          <path d="M40 100c-6-16 2-26 12-32" strokeWidth={7} />
          <circle cx={57} cy={44} r={13} strokeWidth={4} opacity={0.8} />
          <circle cx={57} cy={44} r={22} strokeWidth={2} opacity={0.4} />
          <path d="M57 12v10M57 66v10M27 44h10M77 44h10" strokeWidth={3} opacity={0.6} />
          <text x={104} y={50} fontSize={13} stroke="none" fill="currentColor">
            unisci dito
          </text>
          <text x={104} y={68} fontSize={13} stroke="none" fill="currentColor">
            e pollice
          </text>
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx={62} cy={65} r={26} strokeWidth={5} />
          <circle cx={62} cy={65} r={9} strokeWidth={4} />
          <path d="M62 22v14M62 94v14M105 65H91M33 65H19M92 35L82 45M42 85l-10 10M92 95L82 85M42 45L32 35" strokeWidth={4} />
          <line x1={125} y1={45} x2={180} y2={45} strokeWidth={5} />
          <circle cx={148} cy={45} r={8} strokeWidth={4} />
          <line x1={125} y1={85} x2={180} y2={85} strokeWidth={5} />
          <circle cx={165} cy={85} r={8} strokeWidth={4} />
        </svg>
      );
    case "loop":
      return (
        <svg {...common}>
          {[0, 1, 2, 3].map((r) => (
            <g key={r}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
                <rect
                  key={c}
                  x={20 + c * 21}
                  y={22 + r * 24}
                  width={16}
                  height={16}
                  rx={4}
                  strokeWidth={3}
                  opacity={(r + c) % 3 === 0 ? 1 : 0.3}
                />
              ))}
            </g>
          ))}
        </svg>
      );
    case "keys":
      return (
        <svg {...common}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} x={16 + i * 25} y={35} width={21} height={60} rx={5} strokeWidth={4} opacity={i === 2 ? 1 : 0.35} />
          ))}
          <text x={80} y={26} fontSize={13} stroke="none" fill="currentColor">
            scala scelta
          </text>
        </svg>
      );
  }
}
