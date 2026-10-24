// Item shop: cosmetics bought with tokens. Some items also need a level, which keeps the
// old level-up gear as goals. Nothing here affects scoring.

export type Slot = "hat" | "face" | "outfit" | "back" | "shoes" | "petHat" | "petNeck" | "petAura";

export interface Item {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  minLevel?: number;
}

export const SLOT_NAMES: Record<Slot, string> = {
  hat: "Hat", face: "Face", outfit: "Outfit", back: "Back", shoes: "Shoes",
  petHat: "Pet hat", petNeck: "Pet neck", petAura: "Pet aura",
};

export const ITEMS: Item[] = [
  { id: "headband", name: "Headband", slot: "hat", price: 15 },
  { id: "cap", name: "Ball cap", slot: "hat", price: 30 },
  { id: "beanie", name: "Beanie", slot: "hat", price: 35 },
  { id: "wizard", name: "Wizard hat", slot: "hat", price: 90, minLevel: 6 },
  { id: "crown", name: "Crown", slot: "hat", price: 150, minLevel: 10 },
  { id: "glasses", name: "Round glasses", slot: "face", price: 20 },
  { id: "shades", name: "Sunglasses", slot: "face", price: 40 },
  { id: "stars", name: "Star shades", slot: "face", price: 70, minLevel: 5 },
  { id: "hoodie", name: "Hoodie", slot: "outfit", price: 40 },
  { id: "jacket", name: "Trail jacket", slot: "outfit", price: 60, minLevel: 4 },
  { id: "labcoat", name: "Lab coat", slot: "outfit", price: 80, minLevel: 6 },
  { id: "hero", name: "Hero suit", slot: "outfit", price: 120, minLevel: 9 },
  { id: "pack", name: "Backpack", slot: "back", price: 40, minLevel: 3 },
  { id: "cape", name: "Champion cape", slot: "back", price: 110, minLevel: 8 },
  { id: "wings", name: "Feather wings", slot: "back", price: 160, minLevel: 12 },
  { id: "runners", name: "Running shoes", slot: "shoes", price: 25 },
  { id: "boots", name: "Hiking boots", slot: "shoes", price: 45, minLevel: 4 },
  { id: "party", name: "Party hat", slot: "petHat", price: 20 },
  { id: "flowers", name: "Flower crown", slot: "petHat", price: 45 },
  { id: "tophat", name: "Top hat", slot: "petHat", price: 70, minLevel: 5 },
  { id: "bowtie", name: "Bow tie", slot: "petNeck", price: 20 },
  { id: "scarf", name: "Scarf", slot: "petNeck", price: 35 },
  { id: "bell", name: "Golden bell", slot: "petNeck", price: 60, minLevel: 4 },
  { id: "sparkles", name: "Sparkles", slot: "petAura", price: 80, minLevel: 5 },
  { id: "halo", name: "Halo", slot: "petAura", price: 130, minLevel: 9 },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

export interface Look {
  skin: number;
  hair: number; // style index
  hairColor: number;
  shirt: number;
}

export const SKINS = ["#f6d7c3", "#e9b48f", "#d39a6a", "#b0754a", "#8a5634", "#5e3a22"];
export const HAIR_COLORS = ["#1f1a17", "#5a3825", "#a0612b", "#d9a441", "#b8442f", "#7b5fc4"];
export const SHIRTS = ["#0f8b8d", "#3a6fd6", "#c2477a", "#e0a020", "#5f9c3a", "#55606a"];
export const HAIR_STYLES = ["Short", "Long", "Curly", "Buzz", "Bun"];

export const DEFAULT_LOOK: Look = { skin: 1, hair: 0, hairColor: 0, shirt: 0 };
