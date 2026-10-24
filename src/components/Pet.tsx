import { EVO } from "../game/quest";

export function Pet({ stage, className }: { stage: number; className?: string }) {
  const label = `Your pet, stage ${EVO[stage].name}`;
  if (stage === 0)
    return (
      <svg viewBox="0 0 160 140" role="img" aria-label={label} className={className}>
        <ellipse cx={80} cy={126} rx={50} ry={7} fill="var(--fg)" opacity={0.12} />
        <ellipse cx={80} cy={88} rx={26} ry={34} fill="var(--surface)" stroke="var(--teal)" strokeWidth={3} />
        <path d="M60 84 l8 -6 l8 6 l8 -6 l8 6 l8 -6" stroke="var(--teal)" strokeWidth={3} fill="none" />
      </svg>
    );
  const size = [0, 24, 30, 36, 40][stage];
  const cy = 120 - size;
  return (
    <svg viewBox="0 0 160 140" role="img" aria-label={label} className={className}>
      <ellipse cx={80} cy={126} rx={50} ry={7} fill="var(--fg)" opacity={0.12} />
      {stage >= 4 && <circle cx={80} cy={cy} r={size + 16} fill="var(--sun)" opacity={0.25} />}
      {stage >= 3 && (
        <>
          <path d={`M${80 - size + 4} ${cy - 4} q-30 -24 -34 6 q14 6 34 6 Z`} fill="var(--berry)" opacity={0.85} />
          <path d={`M${80 + size - 4} ${cy - 4} q30 -24 34 6 q-14 6 -34 6 Z`} fill="var(--berry)" opacity={0.85} />
        </>
      )}
      {stage >= 2 && (
        <>
          <path d={`M${80 + size - 6} ${cy + size - 10} q${size} 4 ${size - 4} -${size}`} stroke="var(--teal)" strokeWidth={8} fill="none" strokeLinecap="round" />
          <path d={`M${80 - size * 0.7} ${cy - size * 0.6} l-6 -${size * 0.6} l${size * 0.45} ${size * 0.3} Z`} fill="var(--teal)" />
          <path d={`M${80 + size * 0.7} ${cy - size * 0.6} l6 -${size * 0.6} l-${size * 0.45} ${size * 0.3} Z`} fill="var(--teal)" />
        </>
      )}
      <circle cx={80} cy={cy} r={size} fill="var(--teal)" />
      <ellipse cx={80} cy={cy + size * 0.35} rx={size * 0.6} ry={size * 0.45} fill="var(--surface)" opacity={0.85} />
      <circle cx={80 - size * 0.35} cy={cy - size * 0.15} r={size * 0.14} fill="var(--fg)" />
      <circle cx={80 + size * 0.35} cy={cy - size * 0.15} r={size * 0.14} fill="var(--fg)" />
      <circle cx={80 - size * 0.3} cy={cy - size * 0.2} r={size * 0.05} fill="#fff" />
      <circle cx={80 + size * 0.4} cy={cy - size * 0.2} r={size * 0.05} fill="#fff" />
      <path d={`M${80 - size * 0.15} ${cy + size * 0.12} q${size * 0.15} ${size * 0.12} ${size * 0.3} 0`} stroke="var(--fg)" strokeWidth={2} fill="none" strokeLinecap="round" />
      {stage >= 4 && <path d={`M${80 - 14} ${cy - size - 2} l6 -14 l8 10 l8 -10 l6 14 Z`} fill="var(--sun)" />}
    </svg>
  );
}
