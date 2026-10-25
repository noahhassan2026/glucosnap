import { useState } from "react";
import { HAIR_COLORS, HAIR_STYLES, ITEMS, MONITOR_COLORS, SHIRTS, SKINS, SLOT_NAMES, STICKERS, type Item, type Look, type Slot } from "../game/shop";
import type { QuestState } from "../game/quest";
import { speciesName } from "../game/pets";
import { Avatar } from "./Avatar";
import { Pet } from "./Pet";
import { MonitorArt } from "./Monitor";

type Section = "style" | "character" | "monitor" | "pet";
const CHAR_SLOTS: Slot[] = ["hat", "face", "outfit", "back", "shoes"];
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
          <div className="avatar"><Avatar look={s.look} equipped={tryOn} reading={props.reading ?? SAMPLE_READING} /></div>
          <div className="petbox"><Pet stage={s.evo} path={s.petPath} equipped={tryOn} /></div>
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

      {section === "style" && <StyleEditor look={s.look} onLook={props.onLook} />}

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
                      {pet ? <Pet stage={Math.max(1, s.evo)} path={s.petPath} equipped={{ [slot]: item.id }} />
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

function StyleEditor({ look, onLook }: { look: Look; onLook: (l: Look) => void }) {
  const swatches = (key: "skin" | "hairColor" | "shirt", colors: string[], label: string) => (
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
  return (
    <section className="card">
      <h2>Customize your character</h2>
      {swatches("skin", SKINS, "Skin tone")}
      <div className="style-row">
        <span className="small"><b>Hair</b></span>
        <div className="seg" role="radiogroup" aria-label="Hair style">
          {HAIR_STYLES.map((h, i) => (
            <button key={h} role="radio" aria-checked={look.hair === i} onClick={() => onLook({ ...look, hair: i })}>{h}</button>
          ))}
        </div>
      </div>
      {swatches("hairColor", HAIR_COLORS, "Hair color")}
      {swatches("shirt", SHIRTS, "Shirt color")}
      <p className="note">Styling is free. Change it whenever you like.</p>
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
