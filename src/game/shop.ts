// Item shop: cosmetics bought with tokens. Some items also need a level, which keeps the
// old level-up gear as goals. Nothing here affects scoring.

export type Slot = "hat" | "face" | "outfit" | "back" | "hand" | "shoes" | "monitor" | "petHat" | "petNeck" | "petAura";

export interface Item {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  minLevel?: number;
  lesson?: string; // earned by passing this Learn lesson instead of bought
}

export const SLOT_NAMES: Record<Slot, string> = {
  hat: "Hat", face: "Face", outfit: "Outfit", back: "Back", hand: "In hand", shoes: "Shoes", monitor: "Glucose monitor",
  petHat: "Pet hat", petNeck: "Pet neck", petAura: "Pet aura",
};

export const ITEMS: Item[] = [
  { id: "headband", name: "Headband", slot: "hat", price: 15 },
  { id: "cap", name: "Ball cap", slot: "hat", price: 30 },
  { id: "beanie", name: "Beanie", slot: "hat", price: 35 },
  { id: "chef", name: "Chef hat", slot: "hat", price: 45 },
  { id: "headphones", name: "Headphones", slot: "hat", price: 55, minLevel: 3 },
  { id: "cowboy", name: "Cowboy hat", slot: "hat", price: 65, minLevel: 4 },
  { id: "wizard", name: "Wizard hat", slot: "hat", price: 90, minLevel: 6 },
  { id: "pirate", name: "Pirate hat", slot: "hat", price: 100, minLevel: 7 },
  { id: "crown", name: "Crown", slot: "hat", price: 150, minLevel: 10 },
  { id: "glasses", name: "Round glasses", slot: "face", price: 20 },
  { id: "shades", name: "Sunglasses", slot: "face", price: 40 },
  { id: "monocle", name: "Monocle", slot: "face", price: 45, minLevel: 3 },
  { id: "mask", name: "Hero mask", slot: "face", price: 60, minLevel: 4 },
  { id: "stars", name: "Star shades", slot: "face", price: 70, minLevel: 5 },
  { id: "hoodie", name: "Hoodie", slot: "outfit", price: 40 },
  { id: "jersey", name: "Team jersey", slot: "outfit", price: 50, minLevel: 2 },
  { id: "jacket", name: "Trail jacket", slot: "outfit", price: 60, minLevel: 4 },
  { id: "labcoat", name: "Lab coat", slot: "outfit", price: 80, minLevel: 6 },
  { id: "hero", name: "Hero suit", slot: "outfit", price: 120, minLevel: 9 },
  { id: "astro", name: "Space suit", slot: "outfit", price: 140, minLevel: 11 },
  { id: "pack", name: "Backpack", slot: "back", price: 40, minLevel: 3 },
  { id: "guitar", name: "Guitar", slot: "back", price: 70, minLevel: 5 },
  { id: "cape", name: "Champion cape", slot: "back", price: 110, minLevel: 8 },
  { id: "jetpack", name: "Jetpack", slot: "back", price: 140, minLevel: 10 },
  { id: "wings", name: "Feather wings", slot: "back", price: 160, minLevel: 12 },
  { id: "bottle", name: "Water bottle", slot: "hand", price: 15 },
  { id: "ball", name: "Basketball", slot: "hand", price: 35, minLevel: 2 },
  { id: "racket", name: "Tennis racket", slot: "hand", price: 55, minLevel: 3 },
  { id: "balloon", name: "Balloon", slot: "hand", price: 40 },
  { id: "wand", name: "Magic wand", slot: "hand", price: 100, minLevel: 8 },
  { id: "runners", name: "Running shoes", slot: "shoes", price: 25 },
  { id: "boots", name: "Hiking boots", slot: "shoes", price: 45, minLevel: 4 },
  { id: "skates", name: "Roller skates", slot: "shoes", price: 70, minLevel: 6 },
  { id: "kicks", name: "Light-up kicks", slot: "shoes", price: 90, minLevel: 7 },
  { id: "starter", name: "Starter sensor", slot: "monitor", price: 0, lesson: "cgm" },
  { id: "patch", name: "Comfort overpatch", slot: "monitor", price: 25 },
  { id: "sport", name: "Sport armband", slot: "monitor", price: 45, minLevel: 3 },
  { id: "glow", name: "Glow sensor", slot: "monitor", price: 80, minLevel: 5 },
  { id: "gold", name: "Gold sensor", slot: "monitor", price: 130, minLevel: 9 },
  { id: "party", name: "Party hat", slot: "petHat", price: 20 },
  { id: "beret", name: "Beret", slot: "petHat", price: 30 },
  { id: "flowers", name: "Flower crown", slot: "petHat", price: 45 },
  { id: "tophat", name: "Top hat", slot: "petHat", price: 70, minLevel: 5 },
  { id: "tiara", name: "Tiny crown", slot: "petHat", price: 100, minLevel: 8 },
  { id: "bowtie", name: "Bow tie", slot: "petNeck", price: 20 },
  { id: "scarf", name: "Scarf", slot: "petNeck", price: 35 },
  { id: "pendant", name: "Heart pendant", slot: "petNeck", price: 45, minLevel: 3 },
  { id: "bell", name: "Golden bell", slot: "petNeck", price: 60, minLevel: 4 },
  { id: "bubbles", name: "Bubbles", slot: "petAura", price: 50, minLevel: 3 },
  { id: "sparkles", name: "Sparkles", slot: "petAura", price: 80, minLevel: 5 },
  { id: "rainbow", name: "Rainbow", slot: "petAura", price: 110, minLevel: 7 },
  { id: "halo", name: "Halo", slot: "petAura", price: 130, minLevel: 9 },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

export interface Look {
  skin: number;
  hair: number; // style index
  hairColor: number;
  shirt: number;
  monitorColor: number;
  monitorSticker: number;
  monitorSide: number; // 0 = left arm, 1 = right arm
  showReading: boolean; // bubble with the latest CGM reading next to the sensor
  // Added with the second style pass; older saves get the defaults through migrate().
  eyes: number;
  mouth: number;
  extra: number; // freckles, blush, facial hair
  pants: number;
  scene: number; // background behind the character
  petPattern: number;
}

export const SKINS = ["#f6d7c3", "#e9b48f", "#d39a6a", "#b0754a", "#8a5634", "#5e3a22"];
export const HAIR_COLORS = ["#1f1a17", "#5a3825", "#a0612b", "#d9a441", "#b8442f", "#7b5fc4", "#3a86d1", "#e46f9f", "#4f9d4a", "#d6dde2"];
export const SHIRTS = ["#0f8b8d", "#3a6fd6", "#c2477a", "#e0a020", "#5f9c3a", "#55606a", "#7b5fc4", "#d8432f", "#f2f4f5", "#1f2a33"];
export const PANTS = ["#26333d", "#3b5b8c", "#6b4f3a", "#5f6b4a", "#8a8f96", "#a33a5a"];
export const HAIR_STYLES = ["Short", "Long", "Curly", "Buzz", "Bun", "Mohawk", "Ponytail", "Afro", "Spiky", "Bald"];
export const EYES = ["Dots", "Happy", "Wink", "Sparkle", "Sleepy"];
export const MOUTHS = ["Smile", "Grin", "Tongue", "Wow", "Smirk"];
export const EXTRAS = ["None", "Freckles", "Blush", "Mustache", "Beard"];
export const SCENES = ["Sky", "Sunset", "Forest", "Beach", "Space", "Candy"];
export const PET_PATTERNS = ["Plain", "Spots", "Stripes", "Hearts", "Stars"];

export const MONITOR_COLORS = ["#eef2f4", "#2a3640", "#0f8b8d", "#c2477a", "#3a6fd6", "#e0a020", "#7b5fc4"];
export const STICKERS = ["None", "Heart", "Star", "Bolt", "Smile", "Paw"];

export const DEFAULT_LOOK: Look = { skin: 1, hair: 0, hairColor: 0, shirt: 0, monitorColor: 0, monitorSticker: 0, monitorSide: 1, showReading: true,
  eyes: 0, mouth: 0, extra: 0, pants: 0, scene: 0, petPattern: 0,
};
