// Pet evolution tree. The tiers (Egg → Legendary) are fixed; at Sprite the player picks an
// element and at Guardian a form, so there are six different Legendary pets.

export type Element = "leaf" | "ember" | "tide";
export type Form = "wing" | "horn";

export interface PetPath {
  element?: Element;
  form?: Form;
}

export const ELEMENTS: Record<Element, { name: string; blurb: string; sprite: string }> = {
  leaf: { name: "Leaf", blurb: "Calm and steady. Grows a sprout that blooms as it evolves.", sprite: "Sproutling" },
  ember: { name: "Ember", blurb: "Bold and energetic. Its flame burns brighter with every streak.", sprite: "Emberling" },
  tide: { name: "Tide", blurb: "Easygoing and balanced. Fins that ride the waves.", sprite: "Ripplet" },
};

export const FORMS: Record<Form, { name: string; blurb: string }> = {
  wing: { name: "Wings", blurb: "Light and quick, with wings to fly." },
  horn: { name: "Horns", blurb: "Strong and sturdy, with horns and armor." },
};

const SPECIES: Record<Element, Record<Form, [string, string]>> = {
  leaf: { wing: ["Leafwing", "Sylvan Zephyr"], horn: ["Thornhorn", "Elder Treant"] },
  ember: { wing: ["Flarewing", "Phoenix"], horn: ["Magmahorn", "Volcano Drake"] },
  tide: { wing: ["Skyray", "Aurora Ray"], horn: ["Coralhorn", "Abyss Leviathan"] },
};

export const TIER_NAMES = ["Egg", "Hatchling", "Sprite", "Guardian", "Legendary"];

// Which choice the pet needs before it can evolve into `stage`, if any.
export function choiceFor(stage: number, path: PetPath): "element" | "form" | null {
  if (stage === 2 && !path.element) return "element";
  if (stage === 3 && !path.form) return "form";
  return null;
}

export function speciesName(stage: number, path: PetPath): string {
  if (stage < 2 || !path.element) return TIER_NAMES[stage];
  if (stage === 2 || !path.form) return ELEMENTS[path.element].sprite;
  return SPECIES[path.element][path.form][stage - 3];
}
