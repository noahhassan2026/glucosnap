import { MONITOR_COLORS, SKINS, type Look } from "../game/shop";

const LIGHT = new Set(["#eef2f4", "#e0a020"]);
const WHITE = "#f6f8f9";

function star5(r: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join(" L")} Z`;
}

function Sticker({ kind, color }: { kind: number; color: string }) {
  switch (kind) {
    case 1: return <path d="M0 4 C-6 -0.5 -4 -5.5 0 -2.5 C4 -5.5 6 -0.5 0 4 Z" fill={color} />;
    case 2: return <path d={star5(5)} fill={color} />;
    case 3: return <path d="M1.2 -5 L-3 0.8 L-0.3 0.8 L-1.2 5 L3 -0.8 L0.3 -0.8 Z" fill={color} />;
    case 4:
      return (
        <g fill={color}>
          <circle cx={-1.8} cy={-1.4} r={0.9} /><circle cx={1.8} cy={-1.4} r={0.9} />
          <path d="M-2.6 1 Q0 3.8 2.6 1" stroke={color} strokeWidth={1} fill="none" strokeLinecap="round" />
        </g>
      );
    case 5:
      return (
        <g fill={color}>
          <ellipse cx={0} cy={1.6} rx={2.4} ry={2} />
          {[[-2.7, -1.3], [-0.9, -3.1], [0.9, -3.1], [2.7, -1.3]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={1} />)}
        </g>
      );
    default: return <circle r={1.6} fill={color} opacity={0.5} />;
  }
}

// A CGM sensor drawn in a 10-unit-radius space; `k` scales it into the parent drawing.
export function MonitorShape({ model, look, x = 0, y = 0, k = 1 }: { model: string; look: Look; x?: number; y?: number; k?: number }) {
  const color = MONITOR_COLORS[look.monitorColor] ?? MONITOR_COLORS[0];
  // On the overpatch and armband the chosen color goes on the fabric and the sensor stays white.
  const fabric = model === "patch" || model === "sport";
  const body = model === "gold" ? "#f2b425" : fabric ? WHITE : color;
  const ink = model === "gold" || body === WHITE || LIGHT.has(body) ? "#2a3640" : "#fff";
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      {model === "patch" && <circle r={15} fill={color} stroke="#000" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="2 2" />}
      {model === "sport" && <rect x={-17} y={-6.5} width={34} height={13} rx={4} fill={color} stroke="#000" strokeOpacity={0.15} />}
      {model === "glow" && <circle r={13.5} fill="none" stroke={color} strokeWidth={2.5} className="glow-ring" />}
      <circle r={model === "patch" || model === "sport" ? 9 : 10} fill={body} stroke={model === "gold" ? "#b8860b" : "#000"} strokeOpacity={model === "gold" ? 1 : 0.25} strokeWidth={1} />
      <circle r={6.6} fill="none" stroke="#000" strokeOpacity={0.12} strokeWidth={1} />
      {model === "gold" && <path d="M-6 -4 Q-3 -8 2 -8" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.5} fill="none" strokeLinecap="round" />}
      <Sticker kind={look.monitorSticker} color={ink} />
    </g>
  );
}

// Close-up for shop cards: the sensor on a patch of arm.
export function MonitorArt({ model, look }: { model: string; look: Look }) {
  return (
    <svg viewBox="-24 -22 48 44" role="img" aria-label="Glucose monitor">
      <rect x={-24} y={-16} width={48} height={32} rx={14} fill={SKINS[look.skin] ?? SKINS[1]} />
      <MonitorShape model={model} look={look} />
    </svg>
  );
}

const readingColor = (v: number) => (v < 70 ? "var(--flame)" : v > 180 ? "#b8860b" : "var(--teal)");

// Speech-bubble readout next to the sensor, colored by the 70–180 mg/dL target range.
export function ReadingBubble({ value, side }: { value: number; side: number }) {
  const x = side === 1 ? 86 : 6;
  const tail = side === 1 ? `M${x} 64 L${x - 5} 68 L${x + 4} 66 Z` : `M${x + 28} 64 L${x + 33} 68 L${x + 24} 66 Z`;
  const c = readingColor(value);
  return (
    <g aria-label={`Latest reading ${Math.round(value)} mg/dL`}>
      <path d={tail} fill="var(--surface)" stroke={c} strokeWidth={1} />
      <rect x={x} y={48} width={28} height={19} rx={5} fill="var(--surface)" stroke={c} strokeWidth={1.2} />
      <text x={x + 14} y={59} textAnchor="middle" fontFamily="var(--mono)" fontSize={9} fontWeight={700} fill={c}>{Math.round(value)}</text>
      <text x={x + 14} y={65} textAnchor="middle" fontFamily="var(--mono)" fontSize={4.6} fill="var(--muted)">mg/dL</text>
    </g>
  );
}
