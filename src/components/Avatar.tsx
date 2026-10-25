import { useId } from "react";
import { HAIR_COLORS, PANTS, SHIRTS, SKINS, type Look, type Slot } from "../game/shop";
import { MonitorShape, ReadingBubble } from "./Monitor";

type Equipped = Partial<Record<Slot, string>>;
const INK = "#1f1a17";

// Parts of a hairstyle that sit behind the head.
function HairBack({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 1: // long
      return <path d="M46 40 L46 64 Q42 70 37 66 L38 40 Z M74 40 L74 64 Q78 70 83 66 L82 40 Z" fill={color} />;
    case 6: // ponytail
      return <path d="M74 26 Q96 30 90 62 Q86 52 76 42 Z" fill={color} />;
    case 7: // afro
      return <circle cx={60} cy={34} r={28} fill={color} />;
    default:
      return null;
  }
}

function Hair({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 1: // long
      return <path d="M38 40 Q38 15 60 17 Q82 15 82 40 L84 66 Q78 70 74 62 L74 36 Q66 28 60 29 Q54 28 46 36 L46 62 Q42 70 36 66 Z" fill={color} />;
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
    case 5: // mohawk
      return (
        <>
          <path d="M41 36 Q42 20 60 20 Q78 20 79 36 Q70 29 60 29 Q50 29 41 36 Z" fill={color} opacity={0.35} />
          <path d="M54 28 L50 14 L57 18 L60 4 L63 18 L70 14 L66 28 Q60 25 54 28 Z" fill={color} />
        </>
      );
    case 6: // ponytail
      return <path d="M40 38 Q42 16 60 18 Q78 16 80 38 Q70 28 60 30 Q50 28 40 38 Z" fill={color} />;
    case 7: // afro (front fringe; the volume is behind the head)
      return <path d="M40 36 Q44 22 60 22 Q76 22 80 36 Q70 30 60 31 Q50 30 40 36 Z" fill={color} />;
    case 8: // spiky
      return <path d="M40 38 L37 22 L45 26 L47 12 L54 22 L60 7 L66 22 L73 12 L75 26 L83 22 L80 38 Q70 28 60 30 Q50 28 40 38 Z" fill={color} />;
    case 9: // bald
      return <ellipse cx={52} cy={27} rx={6} ry={3} fill="#fff" opacity={0.3} transform="rotate(-25 52 27)" />;
    default: // short
      return <path d="M40 38 Q42 16 60 18 Q78 16 80 38 Q70 28 60 30 Q50 28 40 38 Z" fill={color} />;
  }
}

function Eyes({ kind }: { kind: number }) {
  const arc = (x: number) => <path key={x} d={`M${x - 2.8} 43 Q${x} 39.2 ${x + 2.8} 43`} stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
  const dot = (x: number) => <circle key={x} cx={x} cy={42} r={2.2} fill={INK} />;
  switch (kind) {
    case 1: return <>{arc(53)}{arc(67)}</>;
    case 2: return <>{dot(53)}{arc(67)}</>;
    case 3:
      return (
        <>
          {[53, 67].map((x) => (
            <g key={x}><circle cx={x} cy={42} r={3.2} fill={INK} /><circle cx={x + 1.1} cy={40.9} r={1.1} fill="#fff" /><circle cx={x - 1} cy={43.2} r={0.5} fill="#fff" /></g>
          ))}
        </>
      );
    case 4:
      return (
        <>
          {[53, 67].map((x) => <path key={x} d={`M${x - 2.8} 41.6 Q${x} 44.4 ${x + 2.8} 41.6`} stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />)}
        </>
      );
    default: return <>{dot(53)}{dot(67)}</>;
  }
}

function Mouth({ kind }: { kind: number }) {
  switch (kind) {
    case 1: return <path d="M53.5 49 Q60 57.5 66.5 49 Z" fill={INK} />;
    case 2:
      return (
        <>
          <path d="M53.5 49 Q60 57.5 66.5 49 Z" fill={INK} />
          <ellipse cx={60} cy={53.2} rx={3} ry={2.2} fill="#e46f9f" />
        </>
      );
    case 3: return <ellipse cx={60} cy={51.5} rx={2.6} ry={3.2} fill={INK} />;
    case 4: return <path d="M55 51.5 Q61 53.5 66 48.5" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />;
    default: return <path d="M54 50 Q60 54 66 50" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />;
  }
}

function Extra({ kind, hair }: { kind: number; hair: string }) {
  switch (kind) {
    case 1:
      return (
        <g fill="#a0612b" opacity={0.7}>
          {[[48.5, 47], [51, 49], [53, 47.2], [67, 47.2], [69, 49], [71.5, 47]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={0.9} />)}
        </g>
      );
    case 2:
      return <g fill="#e46f9f" opacity={0.45}><ellipse cx={48.5} cy={48} rx={3.6} ry={2.1} /><ellipse cx={71.5} cy={48} rx={3.6} ry={2.1} /></g>;
    case 3:
      return <path d="M52.5 49 Q56.5 45.2 60 47.8 Q63.5 45.2 67.5 49 Q63.5 50.6 60 49.2 Q56.5 50.6 52.5 49 Z" fill={hair} />;
    case 4:
      return <path d="M40.5 42 Q41 62 60 62 Q79 62 79.5 42 Q77 54 67 55.5 Q60 58.5 53 55.5 Q43 54 40.5 42 Z" fill={hair} />;
    default:
      return null;
  }
}

// Things held in a hand at (83.5, 101); mirrored when held in the left hand.
function Held({ item }: { item?: string }) {
  switch (item) {
    case "bottle":
      return (
        <g>
          <rect x={86} y={84} width={8} height={18} rx={3} fill="var(--tide)" opacity={0.9} />
          <rect x={87} y={80.5} width={6} height={4.5} rx={1.5} fill="#2a3640" />
          <rect x={86} y={91} width={8} height={4} fill="#fff" opacity={0.5} />
        </g>
      );
    case "ball":
      return (
        <g>
          <circle cx={92} cy={106} r={8.5} fill="#e8663a" />
          <g stroke={INK} strokeWidth={0.8} fill="none" opacity={0.7}>
            <path d="M83.5 106 h17" /><path d="M92 97.5 v17" /><path d="M86 100 Q90 106 86 112" /><path d="M98 100 Q94 106 98 112" />
          </g>
        </g>
      );
    case "racket":
      return (
        <g>
          <path d="M84 102 L92 88" stroke="#5a3825" strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={96.5} cy={78} rx={7} ry={9.5} transform="rotate(30 96.5 78)" fill="#fff" fillOpacity={0.35} stroke="var(--sun)" strokeWidth={2.2} />
          <g stroke="var(--sun)" strokeWidth={0.6} opacity={0.8} transform="rotate(30 96.5 78)">
            <path d="M92 78 h9 M92.5 74 h8 M92.5 82 h8 M96.5 69.5 v17 M93.5 71 v14 M99.5 71 v14" />
          </g>
          <circle cx={104} cy={94} r={3} fill="#d6e85a" />
        </g>
      );
    case "balloon":
      return (
        <g>
          <path d="M84 100 Q92 82 92 60" stroke="var(--muted)" strokeWidth={0.9} fill="none" />
          <ellipse cx={92} cy={49} rx={9} ry={11} fill="var(--berry)" />
          <path d="M90 60 L94 60 L92 57 Z" fill="var(--berry)" />
          <ellipse cx={88.5} cy={45} rx={2.2} ry={3.5} fill="#fff" opacity={0.45} />
        </g>
      );
    case "wand":
      return (
        <g>
          <path d="M84 102 L96 84" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
          <path d={star(97.5, 81.5, 6)} fill="var(--sun)" />
          <g fill="var(--sun)" opacity={0.8}><circle cx={105} cy={76} r={1.2} /><circle cx={90} cy={74} r={1} /><circle cx={104} cy={88} r={0.9} /></g>
        </g>
      );
    default:
      return null;
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

// Free backdrop behind the character on the Quest and Shop cards.
function Scene({ kind, id }: { kind: number; id: string }) {
  const grad = (stops: string[]) => (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {stops.map((c, i) => <stop key={c} offset={i / (stops.length - 1)} stopColor={c} />)}
      </linearGradient>
    </defs>
  );
  switch (kind) {
    case 1: // sunset
      return (
        <g>
          {grad(["#7b5fc4", "#f4845a", "#f5c548"])}
          <rect x={-20} y={0} width={160} height={140} fill={`url(#${id})`} />
          <circle cx={92} cy={108} r={18} fill="#ffe08a" opacity={0.9} />
          <path d="M-20 120 Q30 108 60 118 T140 114 V140 H-20 Z" fill="#5b3f8f" opacity={0.6} />
        </g>
      );
    case 2: // forest
      return (
        <g>
          {grad(["#cdeccb", "#8cc98a"])}
          <rect x={-20} y={0} width={160} height={140} fill={`url(#${id})`} />
          <g fill="#3d7a3a" opacity={0.75}>
            <path d="M2 120 L14 70 L26 120 Z" /><path d="M94 120 L108 62 L122 120 Z" /><path d="M-10 124 L0 88 L10 124 Z" /><path d="M110 124 L120 92 L130 124 Z" />
          </g>
          <path d="M-20 122 Q60 112 140 122 V140 H-20 Z" fill="#5f9c3a" />
        </g>
      );
    case 3: // beach
      return (
        <g>
          {grad(["#bfe4f7", "#8fd0ef"])}
          <rect x={-20} y={0} width={160} height={140} fill={`url(#${id})`} />
          <circle cx={98} cy={22} r={9} fill="#ffd34d" />
          <rect x={-20} y={98} width={160} height={16} fill="#3a86d1" opacity={0.8} />
          <path d="M-20 104 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" stroke="#fff" strokeWidth={1.2} fill="none" opacity={0.7} />
          <path d="M-20 112 Q60 106 140 112 V140 H-20 Z" fill="#f2d7a0" />
        </g>
      );
    case 4: // space
      return (
        <g>
          {grad(["#141832", "#2b2560"])}
          <rect x={-20} y={0} width={160} height={140} fill={`url(#${id})`} />
          <g fill="#fff">
            {[[10, 14, 1], [28, 40, 0.8], [96, 12, 1.2], [108, 58, 0.8], [16, 84, 1], [104, 96, 0.9], [44, 8, 0.7], [84, 30, 0.6], [6, 112, 0.7]].map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />)}
          </g>
          <circle cx={98} cy={30} r={9} fill="#e46f9f" />
          <ellipse cx={98} cy={30} rx={15} ry={3.5} fill="none" stroke="#f5c548" strokeWidth={1.5} transform="rotate(-18 98 30)" />
          <path d="M-20 126 Q60 118 140 126 V140 H-20 Z" fill="#8a8fa8" opacity={0.6} />
        </g>
      );
    case 5: // candy
      return (
        <g>
          {grad(["#ffe1ef", "#ffc7df"])}
          <rect x={-20} y={0} width={160} height={140} fill={`url(#${id})`} />
          {[[12, 18, "#3a86d1", 20], [100, 14, "#f2b425", -30], [22, 60, "#4f9d4a", 50], [104, 52, "#7b5fc4", 10], [10, 100, "#e8663a", -20], [108, 92, "#3a86d1", 40], [56, 6, "#4f9d4a", 70]].map(([x, y, c, a]) => (
            <rect key={`${x}-${y}`} x={x as number} y={y as number} width={8} height={2.6} rx={1.3} fill={c as string} transform={`rotate(${a} ${x} ${y})`} />
          ))}
          <path d="M-20 124 Q60 116 140 124 V140 H-20 Z" fill="#f7a8c9" />
        </g>
      );
    default: // sky
      return (
        <g fill="#fff" opacity={0.55}>
          <ellipse cx={18} cy={20} rx={12} ry={5} /><ellipse cx={26} cy={16} rx={7} ry={5} />
          <ellipse cx={100} cy={34} rx={11} ry={4.5} /><ellipse cx={106} cy={30} rx={6} ry={4} />
        </g>
      );
  }
}

export function Avatar({ look, equipped, className, reading, scene, view = "0 0 120 140" }: {
  look: Look;
  equipped: Equipped;
  className?: string;
  reading?: number;
  scene?: boolean; // draw the chosen backdrop (hero cards only, not shop thumbnails)
  view?: string; // viewBox, to crop to the face for style pickers
}) {
  const sceneId = "scene" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const skin = SKINS[look.skin] ?? SKINS[1];
  const hairColor = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const shirt = SHIRTS[look.shirt] ?? SHIRTS[0];
  const e = equipped;
  const outfit = e.outfit;
  const torso = outfit === "jacket" ? "var(--flame)" : outfit === "hero" ? "#2f55c8" : outfit === "astro" ? "#e8edf0" : shirt;
  const sleeve = outfit === "labcoat" ? "#f4f7f9" : torso;
  const legs = outfit === "astro" ? "#d6dde2" : outfit === "hero" ? "#2f55c8" : PANTS[look.pants] ?? PANTS[0];
  const shoe = e.shoes === "runners" ? "var(--flame)" : e.shoes === "boots" ? "#7a4b2a" : e.shoes === "skates" ? "#f2f4f5" : e.shoes === "kicks" ? "#2a3640" : "var(--muted)";
  // The held item goes in the hand away from the glucose monitor so it doesn't cover the reading.
  const mirror = look.monitorSide === 1 ? "translate(120 0) scale(-1 1)" : undefined;
  return (
    <svg viewBox={view} role="img" aria-label="Your character" className={className}>
      {scene && <Scene kind={look.scene} id={sceneId} />}
      {e.back === "wings" && (
        <g fill="#fff" stroke="var(--line)" strokeWidth={1.5}>
          <path d="M42 70 Q8 50 6 86 Q22 80 42 92 Z" />
          <path d="M78 70 Q112 50 114 86 Q98 80 78 92 Z" />
        </g>
      )}
      {e.back === "cape" && <path d="M38 62 L82 62 L96 128 L24 128 Z" fill="var(--berry)" />}
      {e.back === "pack" && <rect x={30} y={66} width={60} height={44} rx={10} fill="var(--sun)" />}
      {e.back === "guitar" && (
        <g transform="translate(14 2) rotate(-38 60 84)">
          <rect x={57} y={34} width={6} height={40} rx={2} fill="#5a3825" />
          <rect x={55.5} y={30} width={9} height={7} rx={2} fill="#3d2618" />
          <ellipse cx={60} cy={86} rx={11} ry={10} fill="#c0703a" />
          <ellipse cx={60} cy={102} rx={15} ry={13} fill="#c0703a" />
        </g>
      )}
      {e.back === "jetpack" && (
        <g>
          <path d="M26 100 Q31 120 36 100 Z M84 100 Q89 120 94 100 Z" fill="var(--flame)" />
          <path d="M28.5 100 Q31 112 33.5 100 Z M86.5 100 Q89 112 91.5 100 Z" fill="var(--sun)" />
          <rect x={24} y={60} width={14} height={42} rx={7} fill="#8a96a0" />
          <rect x={82} y={60} width={14} height={42} rx={7} fill="#8a96a0" />
          <rect x={24} y={68} width={14} height={4} fill="var(--flame)" /><rect x={82} y={68} width={14} height={4} fill="var(--flame)" />
        </g>
      )}
      {outfit === "hoodie" && <path d="M44 62 Q60 50 76 62 L72 68 Q60 60 48 68 Z" fill={torso} />}
      {/* arms */}
      <rect x={31} y={63} width={11} height={36} rx={5.5} fill={sleeve} />
      <rect x={78} y={63} width={11} height={36} rx={5.5} fill={sleeve} />
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
      {outfit === "jersey" && (
        <>
          <path d="M52 61 L60 70 L68 61" stroke="#fff" strokeWidth={2.5} fill="none" />
          <text x={60} y={96} textAnchor="middle" fontFamily="var(--display)" fontWeight={800} fontSize={18} fill="#fff">7</text>
          <rect x={31} y={70} width={11} height={3} fill="#fff" /><rect x={78} y={70} width={11} height={3} fill="#fff" />
        </>
      )}
      {outfit === "astro" && (
        <>
          <rect x={51} y={74} width={18} height={13} rx={2.5} fill="#2a3640" />
          <circle cx={55.5} cy={80.5} r={2} fill="var(--flame)" /><circle cx={61} cy={80.5} r={2} fill="var(--sun)" /><circle cx={66} cy={80.5} r={1.6} fill="var(--tide)" />
          <rect x={40} y={100} width={40} height={5} fill="var(--tide)" opacity={0.6} />
        </>
      )}
      <rect x={44} y={106} width={12} height={22} rx={5} fill={legs} />
      <rect x={64} y={106} width={12} height={22} rx={5} fill={legs} />
      <rect x={40} y={124} width={18} height={8} rx={4} fill={shoe} />
      <rect x={62} y={124} width={18} height={8} rx={4} fill={shoe} />
      {e.shoes === "skates" && (
        <g fill="var(--berry)">{[44, 54, 66, 76].map((x) => <circle key={x} cx={x} cy={134.5} r={2.6} />)}</g>
      )}
      {e.shoes === "kicks" && (
        <g fill="var(--sun)" className="glow-ring"><rect x={42} y={129} width={14} height={2} rx={1} /><rect x={64} y={129} width={14} height={2} rx={1} /></g>
      )}
      <g transform={mirror}><Held item={e.hand} /></g>
      <circle cx={36.5} cy={100} r={5} fill={skin} />
      <circle cx={83.5} cy={100} r={5} fill={skin} />
      {e.monitor && <MonitorShape model={e.monitor} look={look} x={look.monitorSide === 1 ? 83.5 : 36.5} y={74} k={0.62} />}
      <HairBack style={look.hair} color={hairColor} />
      <circle cx={60} cy={40} r={20} fill={skin} />
      <Hair style={look.hair} color={hairColor} />
      <Extra kind={look.extra} hair={hairColor} />
      <Eyes kind={look.eyes} />
      <Mouth kind={look.mouth} />
      {e.face === "glasses" && (
        <g fill="none" stroke={INK} strokeWidth={1.8}>
          <circle cx={53} cy={42} r={5.5} /><circle cx={67} cy={42} r={5.5} /><path d="M58.5 42 h3" />
        </g>
      )}
      {e.face === "shades" && (
        <g fill={INK}><rect x={46} y={38} width={12} height={8} rx={3} /><rect x={62} y={38} width={12} height={8} rx={3} /><rect x={57} y={40} width={6} height={2} /></g>
      )}
      {e.face === "stars" && (
        <g fill="var(--berry)"><path d={star(53, 42, 7)} /><path d={star(67, 42, 7)} /></g>
      )}
      {e.face === "monocle" && (
        <g>
          <circle cx={67} cy={42} r={5.5} fill="#fff" fillOpacity={0.25} stroke="var(--sun)" strokeWidth={1.8} />
          <path d="M72 44 Q77 54 72 60" stroke="var(--sun)" strokeWidth={0.8} fill="none" />
        </g>
      )}
      {e.face === "mask" && (
        <path fillRule="evenodd" fill="#d8432f"
          d="M42 39 Q60 34 78 39 L77 46 Q68 49 62 45 L58 45 Q52 49 43 46 Z M49.5 42 a3.5 2.8 0 1 0 7 0 a3.5 2.8 0 1 0 -7 0 Z M63.5 42 a3.5 2.8 0 1 0 7 0 a3.5 2.8 0 1 0 -7 0 Z" />
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
      {e.hat === "chef" && (
        <g fill="#fff" stroke="var(--line)" strokeWidth={1}>
          <circle cx={48} cy={18} r={9} /><circle cx={72} cy={18} r={9} /><circle cx={60} cy={12} r={11} />
          <rect x={44} y={20} width={32} height={12} rx={2} />
        </g>
      )}
      {e.hat === "headphones" && (
        <g>
          <path d="M39 40 Q39 15 60 15 Q81 15 81 40" stroke="#2a3640" strokeWidth={4} fill="none" strokeLinecap="round" />
          <rect x={34} y={35} width={9} height={15} rx={4} fill="var(--berry)" />
          <rect x={77} y={35} width={9} height={15} rx={4} fill="var(--berry)" />
        </g>
      )}
      {e.hat === "cowboy" && (
        <g>
          <path d="M46 29 Q44 11 53 11 Q60 15 67 11 Q76 11 74 29 Z" fill="#b07a45" />
          <rect x={45.5} y={23} width={29} height={4} fill="#5a3825" />
          <ellipse cx={60} cy={29} rx={32} ry={5} fill="#9a6b3c" />
        </g>
      )}
      {e.hat === "pirate" && (
        <g>
          <path d="M34 31 Q40 8 60 8 Q80 8 86 31 Q60 23 34 31 Z" fill={INK} />
          <circle cx={60} cy={18} r={3.4} fill="#fff" />
          <path d="M55 24 L65 20 M55 20 L65 24" stroke="#fff" strokeWidth={1.4} strokeLinecap="round" />
        </g>
      )}
      {e.hat === "wizard" && (
        <>
          <path d="M42 30 L60 -2 L78 30 Z" fill="#6a4bc4" />
          <ellipse cx={60} cy={30} rx={26} ry={5} fill="#6a4bc4" />
          <path d={star(62, 16, 4)} fill="var(--sun)" />
        </>
      )}
      {e.hat === "crown" && <path d="M44 28 L44 12 L52 20 L60 8 L68 20 L76 12 L76 28 Z" fill="var(--sun)" stroke="#b8860b" strokeWidth={1} />}
      {outfit === "astro" && <circle cx={60} cy={38} r={25} fill="#bfe4f7" fillOpacity={0.18} stroke="#cfd8de" strokeWidth={2.5} />}
      {e.monitor && look.showReading && reading != null && <ReadingBubble value={reading} side={look.monitorSide} />}
    </svg>
  );
}
