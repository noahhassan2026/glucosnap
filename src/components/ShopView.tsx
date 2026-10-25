import { useState } from "react";
import {
  EXTRAS, EYES, HAIR_COLORS, HAIR_STYLES, ITEMS, MONITOR_COLORS, MOUTHS, PANTS, PET_PATTERNS, SCENES, SHIRTS, SKINS, SLOT_NAMES, STICKERS,
  type Item, type Look, type Slot,
} from "../game/shop";
import type { QuestState } from "../game/quest";
import { speciesName } from "../game/pets";
import { Avatar } from "./Avatar";
import { Pet } from "./Pet";
import { MonitorArt } from "./Monitor";

type Section = "style" | "character" | "monitor" | "pet";
const CHAR_SLOTS: Slot[] = ["hat", "face", "outfit", "back", "hand", "shoes"];
const PET_SLOTS: Slot[] = ["petHat", "petNeck", "petAura"];
const SLOTS: Record<Exclude<Section, "style">, Slot[]> = { character: CHAR_SLOTS, monitor: ["monitor"], pet: PET_SLOTS };
const SAMPLE_READING = 104;

export function Token({ n }: { n: number }) {
  return (
    <span className="token" aria-label={`${n} tokens`}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--sun)" /><circle cx="8" cy="8" r="4.5" fill="none" stroke="#b8860b" strokeWidth="1.5" /></svg>
      {n}
    </span>
  );
}

export function ShopView(props: {
  s: QuestState;
  onBuy: (id: string) => void;
  onToggle: (id: string) => void;
  onLook: (l: Look) => void;
  onLearn: () => void;
  reading?: number; // latest CGM reading, shown on the monitor
}) {
  const { s } = props;
  const [section, setSection] = useState<Section>("character");
  const [preview, setPreview] = useState<Item | null>(null);
  // Hovering or focusing an item tries it on in the preview without buying it.
  const tryOn = preview ? { ...s.equipped, [preview.slot]: preview.id } : s.equipped;

  return (
    <div className="stack">
      <section className="card shop-hero">
        <div className="dressing">
          <div className="avatar"><Avatar look={s.look} equipped={tryOn} reading={props.reading ?? SAMPLE_READING} scene /></div>
          <div className="petbox"><Pet stage={s.evo} path={s.petPath} equipped={tryOn} pattern={s.look.petPattern} /></div>
        </div>
        <div className="spread">
          <div>
            <h2>{s.playerName} &amp; {s.petName}</h2>
            <p className="small muted">{speciesName(s.evo, s.petPath)} · Level {s.level}</p>
          </div>
          <div className="balance"><Token n={s.tokens} /><small>tokens</small></div>
        </div>
        <p className="note">Earn tokens with every quest (1 per 5 XP), plus {20} for each level and {30} for each evolution.</p>
      </section>

      <div className="seg wide" role="tablist" aria-label="Shop sections">
        {([["style", "Style"], ["character", "Character"], ["monitor", "Monitor"], ["pet", "Pet"]] as [Section, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)}>{label}</button>
        ))}
      </div>

      {section === "style" && <StyleEditor look={s.look} equipped={s.equipped} onLook={props.onLook} />}

      {section === "pet" && <PetStyle s={s} onLook={props.onLook} />}

      {section === "monitor" && <MonitorEditor look={s.look} onLook={props.onLook} hasReading={props.reading != null} />}

      {section !== "style" &&
        SLOTS[section].map((slot) => (
          <section key={slot} className="stack-sm">
            <h3>{SLOT_NAMES[slot]}</h3>
            <div className="items">
              {ITEMS.filter((i) => i.slot === slot).map((item) => {
                const owned = s.owned.includes(item.id);
                const on = s.equipped[slot] === item.id;
                const locked = !!item.minLevel && s.level < item.minLevel;
                const short = !owned && !locked && s.tokens < item.price;
                const pet = slot.startsWith("pet");
                return (
                  <div key={item.id} className={"item" + (on ? " on" : "") + (locked ? " locked" : "")}
                    onMouseEnter={() => setPreview(item)} onMouseLeave={() => setPreview(null)}>
                    <div className="item-art">
                      {pet ? <Pet stage={Math.max(1, s.evo)} path={s.petPath} equipped={{ [slot]: item.id }} pattern={s.look.petPattern} />
                        : slot === "monitor" ? <MonitorArt model={item.id} look={s.look} />
                        : <Avatar look={s.look} equipped={{ [slot]: item.id }} />}
                    </div>
                    <span className="item-name">{item.name}</span>
                    {owned ? (
                      <button className={on ? "ghost" : ""} onClick={() => props.onToggle(item.id)}>{on ? "Take off" : "Wear"}</button>
                    ) : item.lesson ? (
                      <button className="ghost" onClick={props.onLearn}>Earn in Learn</button>
                    ) : locked ? (
                      <button disabled>Level {item.minLevel}</button>
                    ) : (
                      <button disabled={short} onClick={() => props.onBuy(item.id)} aria-label={`Buy ${item.name} for ${item.price} tokens`}>
                        <Token n={item.price} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      <p className="note">Everything in the shop is cosmetic. Tokens come from logging meals, moving, keeping streaks and learning, never from eating less.</p>
    </div>
  );
}

// Crops of the 120x140 character drawing used as picture buttons.
const FACE_VIEW = "38 24 44 34";
const HEAD_VIEW = "26 -4 68 72";

function pick<T>(list: readonly T[]) {
  return Math.floor(Math.random() * list.length);
}

function StyleEditor({ look, equipped, onLook }: { look: Look; equipped: Partial<Record<Slot, string>>; onLook: (l: Look) => void }) {
  const swatches = (key: "skin" | "hairColor" | "shirt" | "pants", colors: string[], label: string) => (
    <div className="style-row">
      <span className="small"><b>{label}</b></span>
      <div className="swatches" role="radiogroup" aria-label={label}>
        {colors.map((c, i) => (
          <button key={c} role="radio" aria-checked={look[key] === i} aria-label={`${label} ${i + 1}`}
            className="swatch" style={{ background: c }} onClick={() => onLook({ ...look, [key]: i })} />
        ))}
      </div>
    </div>
  );
  // Picture options: each tile draws the character with that one choice applied.
  const tiles = (key: "hair" | "eyes" | "mouth" | "extra" | "scene", names: string[], label: string, view: string, scene = false) => (
    <div className="style-row">
      <span className="small"><b>{label}</b></span>
      <div className="opt-grid" role="radiogroup" aria-label={label}>
        {names.map((n, i) => (
          <button key={n} role="radio" aria-checked={look[key] === i} className={"opt" + (scene ? " opt-scene" : "")} onClick={() => onLook({ ...look, [key]: i })}>
            <Avatar look={{ ...look, [key]: i }} equipped={scene ? equipped : {}} view={view} scene={scene} />
            <span>{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
  const surprise = () => onLook({
    ...look,
    skin: pick(SKINS), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS), shirt: pick(SHIRTS), pants: pick(PANTS),
    eyes: pick(EYES), mouth: pick(MOUTHS), extra: pick(EXTRAS), scene: pick(SCENES),
  });
  return (
    <section className="card">
      <div className="spread">
        <h2>Style your character</h2>
        <button className="ghost small-btn" onClick={surprise}>🎲 Surprise me</button>
      </div>
      {swatches("skin", SKINS, "Skin tone")}
      {tiles("hair", HAIR_STYLES, "Hair", HEAD_VIEW)}
      {swatches("hairColor", HAIR_COLORS, "Hair color")}
      {tiles("eyes", EYES, "Eyes", FACE_VIEW)}
      {tiles("mouth", MOUTHS, "Mouth", FACE_VIEW)}
      {tiles("extra", EXTRAS, "Face details", FACE_VIEW)}
      {swatches("shirt", SHIRTS, "Shirt color")}
      {swatches("pants", PANTS, "Pants color")}
      {tiles("scene", SCENES, "Background", "0 0 120 140", true)}
      <p className="note">Styling is free. Change it whenever you like.</p>
    </section>
  );
}

function PetStyle({ s, onLook }: { s: QuestState; onLook: (l: Look) => void }) {
  return (
    <section className="card">
      <h2>Style {s.petName}</h2>
      <div className="style-row">
        <span className="small"><b>Coat pattern</b></span>
        <div className="opt-grid" role="radiogroup" aria-label="Coat pattern">
          {PET_PATTERNS.map((n, i) => (
            <button key={n} role="radio" aria-checked={s.look.petPattern === i} className="opt" onClick={() => onLook({ ...s.look, petPattern: i })}>
              <Pet stage={s.evo} path={s.petPath} pattern={i} />
              <span>{n}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="note">Patterns are free. Accessories below cost tokens.</p>
    </section>
  );
}

function MonitorEditor({ look, onLook, hasReading }: { look: Look; onLook: (l: Look) => void; hasReading: boolean }) {
  return (
    <section className="card">
      <h2>Customize your glucose monitor</h2>
      <p className="muted small">A continuous glucose monitor (CGM) is a coin-sized sensor worn on the arm. Pick one below, then make it yours.</p>
      <div className="style-row">
        <span className="small"><b>Color</b></span>
        <div className="swatches" role="radiogroup" aria-label="Monitor color">
          {MONITOR_COLORS.map((c, i) => (
            <button key={c} role="radio" aria-checked={look.monitorColor === i} aria-label={`Monitor color ${i + 1}`}
              className="swatch" style={{ background: c }} onClick={() => onLook({ ...look, monitorColor: i })} />
          ))}
        </div>
      </div>
      <div className="style-row">
        <span className="small"><b>Sticker</b></span>
        <div className="seg wrap" role="radiogroup" aria-label="Sticker">
          {STICKERS.map((n, i) => (
            <button key={n} role="radio" aria-checked={look.monitorSticker === i} onClick={() => onLook({ ...look, monitorSticker: i })}>{n}</button>
          ))}
        </div>
      </div>
      <div className="spread">
        <div className="style-row">
          <span className="small"><b>Wear it on</b></span>
          <div className="seg" role="radiogroup" aria-label="Which side">
            {["Left", "Right"].map((n, i) => (
              <button key={n} role="radio" aria-checked={look.monitorSide === i} onClick={() => onLook({ ...look, monitorSide: i })}>{n}</button>
            ))}
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={look.showReading} onChange={(e) => onLook({ ...look, showReading: e.target.checked })} />
          Show my reading
        </label>
      </div>
      <p className="note">
        {hasReading ? "The bubble shows your latest reading from the Health tab: teal is in the 70–180 mg/dL target range."
          : "The bubble shows a sample reading here. Add sensor data in the Health tab to see your own."}
      </p>
    </section>
  );
}
