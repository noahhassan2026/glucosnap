import { hasGear } from "../game/quest";

export function Avatar({ level, className }: { level: number; className?: string }) {
  const has = (id: string) => hasGear(level, id);
  const shoe = has("shoes") ? "var(--flame)" : "var(--muted)";
  return (
    <svg viewBox="0 0 120 140" role="img" aria-label={`Your character at level ${level}`} className={className}>
      {has("cape") && <path d="M38 62 L82 62 L96 128 L24 128 Z" fill="var(--berry)" />}
      {has("pack") && <rect x={30} y={66} width={60} height={44} rx={10} fill="var(--sun)" />}
      <rect x={40} y={60} width={40} height={50} rx={14} fill={has("jacket") ? "var(--flame)" : "var(--teal)"} />
      <rect x={44} y={106} width={12} height={22} rx={5} fill="var(--fg)" />
      <rect x={64} y={106} width={12} height={22} rx={5} fill="var(--fg)" />
      <rect x={40} y={124} width={18} height={8} rx={4} fill={shoe} />
      <rect x={62} y={124} width={18} height={8} rx={4} fill={shoe} />
      <circle cx={60} cy={40} r={20} fill="var(--skin)" />
      <path d="M40 38 Q42 16 60 18 Q78 16 80 38 Q70 28 60 30 Q50 28 40 38 Z" fill="var(--fg)" />
      {has("band") && <rect x={40} y={30} width={40} height={6} rx={3} fill="var(--berry)" />}
      <circle cx={53} cy={42} r={2.2} fill="var(--fg)" />
      <circle cx={67} cy={42} r={2.2} fill="var(--fg)" />
      <path d="M54 50 Q60 54 66 50" stroke="var(--fg)" strokeWidth={2} fill="none" strokeLinecap="round" />
    </svg>
  );
}
