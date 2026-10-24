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

export function Pet({ stage, path = {}, equipped = {}, className }: {
  stage: number;
  path?: PetPath;
  equipped?: Partial<Record<Slot, string>>;
  className?: string;
}) {
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
      {aura === "halo" && <ellipse cx={80} cy={top - 12} rx={20} ry={5} fill="none" stroke="var(--sun)" strokeWidth={3.5} />}
      {egg ? (
        <>
          <ellipse cx={80} cy={88} rx={26} ry={34} fill="var(--surface)" stroke="var(--teal)" strokeWidth={3} />
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
