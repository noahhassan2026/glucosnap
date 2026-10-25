// Contract shared with the model server (api/). See docs/API.md.

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Macros {
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  calories?: number;
}

export interface Profile {
  age?: number;
  sex?: "M" | "F";
  bmi?: number;
  a1c?: number;
  fasting_glu?: number;
}

export interface CgmPoint {
  t: string; // ISO timestamp
  mg_dl: number;
}

export interface PredictContext {
  meal_type: MealType;
  hour: number;
  pre_glucose_mg_dl?: number;
  profile?: Profile;
  macros?: Macros;
  cgm_last_6h?: CgmPoint[]; // superseded by cgm_recent, still accepted
  cgm_recent?: CgmPoint[]; // up to 3 days ending at the meal
  walk_after_meal_min?: number;
}

export interface FoodItem {
  name: string;
  portion: string;
  carbs: number;
}

export interface Meal extends Required<Macros> {
  label: string;
  confidence: number;
  source?: "photo" | "user";
  items?: FoodItem[]; // photo estimates only
}

export type Tier = "sensor" | "labs" | "basic";

export interface Curve {
  minutes: number[]; // 0, 15, ..., 120
  delta_mg_dl: number[];
  delta_low: number[];
  delta_high: number[];
  baseline_mg_dl: number | null;
  peak_delta_mg_dl: number;
  peak_minute: number;
  mae_mg_dl: number;
  tier: Tier;
}

export type SuggestionKind = "walk" | "swap" | "add_protein" | "add_fiber";

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  text: string;
  peak_delta_mg_dl: number;
  peak_reduction_pct: number;
}

export interface PredictResponse {
  meal: Meal;
  curve: Curve;
  suggestions: Suggestion[];
  model_version: string;
}

export type RiskStatus = "normal" | "prediabetes" | "t2d";

export interface RiskRequest {
  cgm: CgmPoint[];
  profile?: Profile;
}

export interface RiskResponse {
  a1c_estimate: number;
  a1c_mae: number;
  status: RiskStatus;
  status_probs: Record<RiskStatus, number>;
  homa_ir_estimate?: number;
  days_of_data: number;
}

export interface HealthResponse {
  ok: boolean;
  model_version: string;
  vision_provider: "navigator" | "anthropic" | null;
  vision_model: string | null;
  coach_model?: string | null;
}

// ---------- AI coach (POST /api/quests, POST /api/meal-ideas) ----------

export type QuestCategory = "move" | "order" | "pair" | "swap" | "hydrate" | "sleep" | "stress" | "plan" | "cook";

export interface CoachMeal {
  label: string;
  meal_type?: MealType;
  carbs: number;
  protein?: number;
  fat?: number;
  fiber?: number;
  peak?: number; // predicted rise, mg/dL
}

export interface QuestsRequest {
  meals: CoachMeal[]; // newest first, up to 10
  profile?: Profile;
  risk_status?: RiskStatus;
  hour: number;
  count?: number;
  have?: string[]; // titles already on today's list
  exclude?: string[]; // quest ids shown before
  seed?: string;
}

export interface CoachQuest {
  id: string;
  title: string;
  why: string;
  category: QuestCategory;
  xp: number;
}

export interface QuestsResponse {
  quests: CoachQuest[];
  coach_note: string;
  source: "ai" | "library";
  model: string | null;
}

export type Diet = "any" | "vegetarian" | "vegan";

export interface MealIdeasRequest {
  meal_type: MealType;
  diet?: Diet;
  budget?: number; // US dollars per serving
  pantry?: string;
  count?: number;
  exclude?: string[]; // idea ids shown before
  profile?: Profile;
}

export interface MealIdea {
  id: string;
  name: string;
  why: string;
  cost_usd: number;
  minutes: number;
  ingredients: string[];
  steps: string[];
  macros: Required<Macros>;
  peak_delta_mg_dl: number;
  peak_minute: number;
  tier: Tier;
  source: "ai" | "library";
}

export interface MealIdeasResponse {
  ideas: MealIdea[];
  source: "ai" | "library";
  model: string | null;
  model_version: string;
}
