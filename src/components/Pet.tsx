import { useId } from "react";
import { speciesName, type PetPath } from "../game/pets";
import type { Slot } from "../game/shop";

const ELEMENT_COLOR = { leaf: "var(--leaf)", ember: "var(--ember)", tide: "var(--tide)" };

function star(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i;
    const rr = i % 2 ? r * 0.35 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join(" L")} Z`;
}

function heart(x: number, y: number, r: number) {
  return `M${x} ${y + r * 0.8} C${x - r * 1.4} ${y - r * 0.1} ${x - r * 0.9} ${y - r * 1.2} ${x} ${y - r * 0.4} C${x + r * 0.9} ${y - r * 1.2} ${x + r * 1.4} ${y - r * 0.1} ${x} ${y + r * 0.8} Z`;
}

// Free coat pattern, clipped to the body (or the egg shell).
function Pattern({ kind, cx, cy, r, egg }: { kind: number; cx: number; cy: number; r: number; egg?: boolean }) {
  const ink = egg ? "var(--teal)" : "#000";
  const inkOpacity = egg ? 0.3 : 0.16;
  const spots: [number, number, number][] = [[-0.55, -0.45, 0.2], [0.5, -0.6, 0.15], [0.62, 0.05, 0.18], [-0.7, 0.2, 0.14], [0.05, -0.85, 0.12]];
  switch (kind) {
    case 1:
      return <g fill={ink} opacity={inkOpacity}>{spots.map(([x, y, k]) => <circle key={x} cx={cx + x * r} cy={cy + y * r} r={k * r} />)}</g>;
    case 2:
      return (
        <g stroke={ink} strokeOpacity={inkOpacity} strokeWidth={r * 0.16} strokeLinecap="round" fill="none">
          {[-0.75, -0.42, -0.1].map((y) => <path key={y} d={`M${cx - r} ${cy + y * r} q${r} ${-r * 0.22} ${r * 2} 0`} />)}
        </g>
      );
    case 3:
      return <g fill={egg ? "var(--berry)" : "#fff"} opacity={egg ? 0.7 : 0.6}>{spots.slice(0, 4).map(([x, y, k]) => <path key={x} d={heart(cx + x * r, cy + y * r, k * r * 0.9)} />)}</g>;
    case 4:
      return <g fill="var(--sun)" opacity={0.85}>{spots.slice(0, 4).map(([x, y, k]) => <path key={x} d={star(cx + x * r, cy + y * r, k * r * 1.1)} />)}</g>;
    default:
      return null;
  }
}

export function Pet({ stage, path = {}, equipped = {}, className, pattern = 0 }: {
  stage: number;
  path?: PetPath;
  equipped?: Partial<Record<Slot, string>>;
  className?: string;
  pattern?: number;
}) {
  const clip = "petclip" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const label = `Your pet, ${speciesName(stage, path)}`;
  const egg = stage === 0;
  const size = egg ? 30 : [0, 24, 30, 36, 40][stage];
  const cy = egg ? 88 : 120 - size;
  const top = egg ? 54 : cy - size; // top of head, where hats sit
  const body = path.element && stage >= 2 ? ELEMENT_COLOR[path.element] : "var(--teal)";
  const accent = path.element === "ember" ? "var(--sun)" : path.element === "tide" ? "var(--teal)" : path.element === "leaf" ? "var(--sun)" : "var(--berry)";
  const hat = equipped.petHat, neck = equipped.petNeck, aura = equipped.petAura;
  return (
    <svg viewBox="-8 0 176 140" role="img" aria-label={label} className={className}>
      <ellipse cx={80} cy={126} rx={50} ry={7} fill="var(--fg)" opacity={0.12} />
      {stage >= 4 && <circle cx={80} cy={cy} r={size + 16} fill="var(--sun)" opacity={0.25} />}
      {aura === "sparkles" && (
        <g fill="var(--sun)">{[[30, 40, 6], [130, 50, 5], [120, 100, 4], [40, 96, 5], [80, 18, 4]].map(([x, y, r]) => <path key={x} d={star(x, y, r)} />)}</g>
      )}
      {aura === "rainbow" && (
        <g fill="none" strokeWidth={5} opacity={0.8}>
          {["#d8432f", "var(--sun)", "var(--leaf)", "var(--tide)"].map((c, i) => {
            const r = (egg ? 40 : size + 26) - i * 5;
            const y = egg ? 96 : cy + 6;
            return <path key={c} d={`M${80 - r} ${y} A${r} ${r} 0 0 1 ${80 + r} ${y}`} stroke={c} />;
          })}
        </g>
      )}
      {aura === "bubbles" && (
        <g fill="#fff" fillOpacity={0.35} stroke="var(--tide)" strokeWidth={1.5}>
          {[[26, 48, 7], [136, 40, 5], [130, 92, 8], [32, 100, 4.5], [118, 18, 4]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} />)}
        </g>
      )}
      {aura === "halo" && <ellipse cx={80} cy={top - 12} rx={20} ry={5} fill="none" stroke="var(--sun)" strokeWidth={3.5} />}
      {egg ? (
        <>
          <defs><clipPath id={clip}><ellipse cx={80} cy={88} rx={26} ry={34} /></clipPath></defs>
          <ellipse cx={80} cy={88} rx={26} ry={34} fill="var(--surface)" stroke="var(--teal)" strokeWidth={3} />
          {pattern > 0 && <g clipPath={`url(#${clip})`}><Pattern kind={pattern} cx={80} cy={92} r={28} egg /></g>}
          <path d="M60 84 l8 -6 l8 6 l8 -6 l8 6 l8 -6" stroke="var(--teal)" strokeWidth={3} fill="none" />
        </>
      ) : (
        <>
          {stage >= 3 && path.form === "wing" && (
            <>
              <path d={`M${80 - size + 4} ${cy - 4} q-30 -24 -34 6 q14 6 34 6 Z`} fill={accent} opacity={0.9} />
              <path d={`M${80 + size - 4} ${cy - 4} q30 -24 34 6 q-14 6 -34 6 Z`} fill={accent} opacity={0.9} />
            </>
          )}
          {stage >= 3 && path.form === "horn" && (
            <g fill={accent}>
              {[-75, -45, -15].map((deg) => {
                const a = (deg * Math.PI) / 180, d = 0.16;
                const p = (r: number, t: number) => `${(80 + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`;
                return <path key={deg} d={`M${p(size - 2, a - d)} L${p(size + 10, a)} L${p(size - 2, a + d)} Z`} />;
              })}
            </g>
          )}
          {/* tail */}
          {stage >= 2 && path.element === "tide" ? (
            <path d={`M${80 + size - 6} ${cy + size * 0.5} l${size * 0.7} -${size * 0.5} l0 ${size * 0.9} Z`} fill={body} />
          ) : stage >= 2 ? (
            <path d={`M${80 + size - 6} ${cy + size - 10} q${size} 4 ${size - 4} -${size}`} stroke={body} strokeWidth={8} fill="none" strokeLinecap="round" />
          ) : null}
          {stage >= 2 && path.element === "ember" && (
            <path d={`M${80 + size * 2 - 10} ${cy - 4} q-8 -6 -2 -16 q2 8 8 6 q2 6 -6 10 Z`} fill="var(--sun)" />
          )}
          {stage >= 2 && path.element === "leaf" && stage >= 3 && (
            <path d={`M${80 + size * 2 - 10} ${cy - 8} q10 -10 4 -18 q-12 6 -4 18 Z`} fill="var(--leaf)" />
          )}
          {/* ears */}
          {stage >= 2 && path.element !== "tide" && (
            <>
              <path d={`M${80 - size * 0.7} ${cy - size * 0.6} l-6 -${size * 0.6} l${size * 0.45} ${size * 0.3} Z`} fill={body} />
              <path d={`M${80 + size * 0.7} ${cy - size * 0.6} l6 -${size * 0.6} l-${size * 0.45} ${size * 0.3} Z`} fill={body} />
            </>
          )}
          <circle cx={80} cy={cy} r={size} fill={body} />
          <defs><clipPath id={clip}><circle cx={80} cy={cy} r={size} /></clipPath></defs>
          {pattern > 0 && <g clipPath={`url(#${clip})`}><Pattern kind={pattern} cx={80} cy={cy} r={size} /></g>}
          <ellipse cx={80} cy={cy + size * 0.35} rx={size * 0.6} ry={size * 0.45} fill="var(--surface)" opacity={0.85} />
          {/* head feature by element */}
          {stage >= 2 && path.element === "leaf" && !hat && (
            <g>
              <path d={`M80 ${top + 2} l0 -10`} stroke="#3d7a3a" strokeWidth={3} strokeLinecap="round" />
              <path d={`M80 ${top - 7} q-12 -8 -14 2 q8 4 14 -2 Z`} fill="var(--leaf)" />
              <path d={`M80 ${top - 7} q12 -8 14 2 q-8 4 -14 -2 Z`} fill="var(--leaf)" />
              {stage >= 4 && <circle cx={80} cy={top - 10} r={4} fill="var(--berry)" />}
            </g>
          )}
          {stage >= 2 && path.element === "ember" && !hat && (
            <path d={`M70 ${top + 4} q-2 -14 10 -20 q-2 8 4 10 q4 -6 2 -12 q10 8 4 22 Z`} fill="var(--sun)" />
          )}
          {stage >= 2 && path.element === "tide" && !hat && (
            <path d={`M70 ${top + 3} q8 -18 22 -14 q-8 4 -6 14 Z`} fill={body} />
          )}
          {stage >= 3 && path.form === "horn" && (
            <g fill="var(--surface)" stroke={accent} strokeWidth={1.5}>
              <path d={`M${80 - size * 0.45} ${top + size * 0.25} q-6 -14 -14 -16 q4 10 6 20 Z`} />
              <path d={`M${80 + size * 0.45} ${top + size * 0.25} q6 -14 14 -16 q-4 10 -6 20 Z`} />
            </g>
          )}
          <circle cx={80 - size * 0.35} cy={cy - size * 0.15} r={size * 0.14} fill="#1f1a17" />
          <circle cx={80 + size * 0.35} cy={cy - size * 0.15} r={size * 0.14} fill="#1f1a17" />
          <circle cx={80 - size * 0.3} cy={cy - size * 0.2} r={size * 0.05} fill="#fff" />
          <circle cx={80 + size * 0.4} cy={cy - size * 0.2} r={size * 0.05} fill="#fff" />
          <path d={`M${80 - size * 0.15} ${cy + size * 0.12} q${size * 0.15} ${size * 0.12} ${size * 0.3} 0`} stroke="#1f1a17" strokeWidth={2} fill="none" strokeLinecap="round" />
          {stage >= 4 && !hat && <path d={`M66 ${top - 2} l6 -14 l8 10 l8 -10 l6 14 Z`} fill="var(--sun)" />}
          {neck === "bowtie" && (
            <g fill="var(--berry)">
              <path d={`M80 ${cy + size * 0.42} l-9 -5 l0 10 Z`} /><path d={`M80 ${cy + size * 0.42} l9 -5 l0 10 Z`} />
              <circle cx={80} cy={cy + size * 0.42} r={2.5} />
            </g>
          )}
          {neck === "scarf" && (
            <g fill="var(--flame)">
              <rect x={80 - size * 0.7} y={cy + size * 0.3} width={size * 1.4} height={7} rx={3.5} />
              <rect x={80 + size * 0.2} y={cy + size * 0.3} width={7} height={16} rx={3} />
            </g>
          )}
          {neck === "pendant" && (
            <g>
              <path d={`M${80 - size * 0.6} ${cy + size * 0.32} q${size * 0.6} 8 ${size * 1.2} 0`} stroke="var(--sun)" strokeWidth={1.5} fill="none" />
              <path d={heart(80, cy + size * 0.5, 5)} fill="var(--berry)" stroke="#fff" strokeWidth={0.8} />
            </g>
          )}
          {neck === "bell" && (
            <g>
              <path d={`M${80 - size * 0.6} ${cy + size * 0.32} q${size * 0.6} 8 ${size * 1.2} 0`} stroke="var(--berry)" strokeWidth={3} fill="none" />
              <circle cx={80} cy={cy + size * 0.5} r={5} fill="var(--sun)" stroke="#b8860b" strokeWidth={1} />
            </g>
          )}
        </>
      )}
      {hat === "party" && (
        <g>
          <path d={`M68 ${top + 4} L80 ${top - 22} L92 ${top + 4} Z`} fill="var(--berry)" />
          <path d={`M72 ${top - 4} L88 ${top - 4}`} stroke="var(--sun)" strokeWidth={2.5} />
          <circle cx={80} cy={top - 23} r={3.5} fill="var(--sun)" />
        </g>
      )}
      {hat === "flowers" && (
        <g>
          {[-16, -8, 0, 8, 16].map((dx, i) => (
            <circle key={dx} cx={80 + dx} cy={top + 3 + Math.abs(dx) * 0.25} r={4.5} fill={i % 2 ? "var(--sun)" : "var(--berry)"} />
          ))}
        </g>
      )}
      {hat === "beret" && (
        <g transform={`rotate(-12 80 ${top})`}>
          <ellipse cx={80} cy={top} rx={18} ry={6.5} fill="#d8432f" />
          <circle cx={80} cy={top - 6} r={2.5} fill="#d8432f" />
        </g>
      )}
      {hat === "tiara" && (
        <g>
          <path d={`M68 ${top + 3} L68 ${top - 8} L74 ${top - 3} L80 ${top - 13} L86 ${top - 3} L92 ${top - 8} L92 ${top + 3} Z`} fill="var(--sun)" stroke="#b8860b" strokeWidth={1} />
          <circle cx={80} cy={top - 2} r={2.2} fill="var(--berry)" /><circle cx={72} cy={top} r={1.5} fill="var(--tide)" /><circle cx={88} cy={top} r={1.5} fill="var(--tide)" />
        </g>
      )}
      {hat === "tophat" && (
        <g fill="#1f1a17">
          <rect x={66} y={top - 2} width={28} height={5} rx={2} />
          <rect x={70} y={top - 22} width={20} height={21} rx={2} />
          <rect x={70} y={top - 7} width={20} height={4} fill="var(--berry)" />
        </g>
      )}
    </svg>
  );
}
