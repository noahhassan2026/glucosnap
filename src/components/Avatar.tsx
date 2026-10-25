import { HAIR_COLORS, SHIRTS, SKINS, type Look, type Slot } from "../game/shop";
import { MonitorShape, ReadingBubble } from "./Monitor";

type Equipped = Partial<Record<Slot, string>>;

function Hair({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 1: // long
      return (
        <>
          <path d="M38 40 Q38 15 60 17 Q82 15 82 40 L84 66 Q78 70 74 62 L74 36 Q66 28 60 29 Q54 28 46 36 L46 62 Q42 70 36 66 Z" fill={color} />
        </>
      );
    case 2: // curly
      return (
        <g fill={color}>
          {[[42, 30], [48, 22], [56, 18], [64, 18], [72, 22], [78, 30], [40, 39], [80, 39]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={7.5} />
          ))}
        </g>
      );
    case 3: // buzz
      return <path d="M41 36 Q42 20 60 20 Q78 20 79 36 Q70 29 60 29 Q50 29 41 36 Z" fill={color} opacity={0.85} />;
    case 4: // bun
      return (
        <>
          <circle cx={60} cy={13} r={8} fill={color} />
          <path d="M40 38 Q42 16 60 18 Q78 16 80 38 Q70 28 60 30 Q50 28 40 38 Z" fill={color} />
        </>
      );
    default: // short
      return <path d="M40 38 Q42 16 60 18 Q78 16 80 38 Q70 28 60 30 Q50 28 40 38 Z" fill={color} />;
  }
}

function star(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join(" L")} Z`;
}

export function Avatar({ look, equipped, className, reading }: { look: Look; equipped: Equipped; className?: string; reading?: number }) {
  const skin = SKINS[look.skin] ?? SKINS[1];
  const hairColor = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const shirt = SHIRTS[look.shirt] ?? SHIRTS[0];
  const e = equipped;
  const outfit = e.outfit;
  const torso = outfit === "jacket" ? "var(--flame)" : outfit === "hero" ? "#2f55c8" : outfit === "hoodie" ? shirt : shirt;
  const shoe = e.shoes === "runners" ? "var(--flame)" : e.shoes === "boots" ? "#7a4b2a" : "var(--muted)";
  return (
    <svg viewBox="0 0 120 140" role="img" aria-label="Your character" className={className}>
      {e.back === "wings" && (
        <g fill="#fff" stroke="var(--line)" strokeWidth={1.5}>
          <path d="M42 70 Q8 50 6 86 Q22 80 42 92 Z" />
          <path d="M78 70 Q112 50 114 86 Q98 80 78 92 Z" />
        </g>
      )}
      {e.back === "cape" && <path d="M38 62 L82 62 L96 128 L24 128 Z" fill="var(--berry)" />}
      {e.back === "pack" && <rect x={30} y={66} width={60} height={44} rx={10} fill="var(--sun)" />}
      {outfit === "hoodie" && <path d="M44 62 Q60 50 76 62 L72 68 Q60 60 48 68 Z" fill={torso} />}
      <rect x={40} y={60} width={40} height={50} rx={14} fill={torso} />
      {outfit === "hoodie" && <path d="M54 92 h12 v8 h-12 z" fill="#000" opacity={0.15} />}
      {outfit === "jacket" && <line x1={60} y1={62} x2={60} y2={108} stroke="#000" strokeOpacity={0.25} strokeWidth={2} />}
      {outfit === "labcoat" && (
        <>
          <path d="M40 74 Q40 60 52 60 L56 60 L60 76 L64 60 L68 60 Q80 60 80 74 L80 110 L40 110 Z" fill="#f4f7f9" />
          <line x1={60} y1={78} x2={60} y2={110} stroke="var(--line)" strokeWidth={1.5} />
          <rect x={66} y={84} width={8} height={6} rx={1} fill="var(--line)" />
        </>
      )}
      {outfit === "hero" && <path d={star(60, 82, 9)} fill="var(--sun)" />}
      <rect x={44} y={106} width={12} height={22} rx={5} fill="var(--fg)" />
      <rect x={64} y={106} width={12} height={22} rx={5} fill="var(--fg)" />
      <rect x={40} y={124} width={18} height={8} rx={4} fill={shoe} />
      <rect x={62} y={124} width={18} height={8} rx={4} fill={shoe} />
      {e.monitor && <MonitorShape model={e.monitor} look={look} x={look.monitorSide === 1 ? 79 : 41} y={74} k={0.72} />}
      {look.hair === 1 && <path d="M46 40 L46 64 Q42 70 37 66 L38 40 Z M74 40 L74 64 Q78 70 83 66 L82 40 Z" fill={hairColor} />}
      <circle cx={60} cy={40} r={20} fill={skin} />
      <Hair style={look.hair} color={hairColor} />
      <circle cx={53} cy={42} r={2.2} fill="#1f1a17" />
      <circle cx={67} cy={42} r={2.2} fill="#1f1a17" />
      <path d="M54 50 Q60 54 66 50" stroke="#1f1a17" strokeWidth={2} fill="none" strokeLinecap="round" />
      {e.face === "glasses" && (
        <g fill="none" stroke="#1f1a17" strokeWidth={1.8}>
          <circle cx={53} cy={42} r={5.5} /><circle cx={67} cy={42} r={5.5} /><path d="M58.5 42 h3" />
        </g>
      )}
      {e.face === "shades" && (
        <g fill="#1f1a17"><rect x={46} y={38} width={12} height={8} rx={3} /><rect x={62} y={38} width={12} height={8} rx={3} /><rect x={57} y={40} width={6} height={2} /></g>
      )}
      {e.face === "stars" && (
        <g fill="var(--berry)"><path d={star(53, 42, 7)} /><path d={star(67, 42, 7)} /></g>
      )}
      {e.hat === "headband" && <rect x={40} y={30} width={40} height={6} rx={3} fill="var(--berry)" />}
      {e.hat === "cap" && (
        <>
          <path d="M40 34 Q40 16 60 16 Q80 16 80 34 Z" fill="var(--teal)" />
          <path d="M60 30 L92 32 Q92 36 80 36 L60 34 Z" fill="var(--teal)" />
        </>
      )}
      {e.hat === "beanie" && (
        <>
          <path d="M39 36 Q39 12 60 12 Q81 12 81 36 Z" fill="var(--berry)" />
          <rect x={38} y={32} width={44} height={7} rx={3} fill="var(--berry)" />
          <circle cx={60} cy={10} r={5} fill="#fff" />
        </>
      )}
      {e.hat === "wizard" && (
        <>
          <path d="M42 30 L60 -2 L78 30 Z" fill="#6a4bc4" />
          <ellipse cx={60} cy={30} rx={26} ry={5} fill="#6a4bc4" />
          <path d={star(62, 16, 4)} fill="var(--sun)" />
        </>
      )}
      {e.hat === "crown" && <path d="M44 28 L44 12 L52 20 L60 8 L68 20 L76 12 L76 28 Z" fill="var(--sun)" stroke="#b8860b" strokeWidth={1} />}
      {e.monitor && look.showReading && reading != null && <ReadingBubble value={reading} side={look.monitorSide} />}
    </svg>
  );
}
