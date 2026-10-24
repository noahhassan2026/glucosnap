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

export interface Meal extends Required<Macros> {
  label: string;
  confidence: number;
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

export type SuggestionKind = "walk" | "swap" | "add_protein";

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
