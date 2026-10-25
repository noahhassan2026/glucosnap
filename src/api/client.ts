import type { MealIdeasRequest, PredictContext, PredictResponse, QuestsRequest, RiskRequest, RiskResponse } from "./types";
import { mockPredict, mockRisk } from "./mock";
import { mockMealIdeas, mockQuests } from "./coachMock";
import { ApiError } from "./errors";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === "1";

export type Source = "model" | "demo";

export { ApiError };

// The server is unreachable or not deployed yet: fall back to the built-in mock
// so the demo always works. Real errors from a running server (422, 503) are surfaced.
// The Vite dev proxy answers an empty 500 when nothing listens on the target port.
function unreachable(e: unknown, res?: Response, body?: string) {
  if (e instanceof TypeError) return true;
  if (!res) return false;
  return res.status === 404 || res.status === 502 || res.status === 504 || (res.status === 500 && !body);
}

function errorText(res: Response, body: string) {
  try {
    const j = JSON.parse(body);
    return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
  } catch {
    return body || res.statusText;
  }
}

export async function predict(photo: File | null, context: PredictContext): Promise<{ data: PredictResponse; source: Source }> {
  if (FORCE_MOCK) return { data: await mockPredict(photo, context), source: "demo" };
  const form = new FormData();
  if (photo) form.append("photo", photo);
  form.append("context", JSON.stringify(context));
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/predict`, { method: "POST", body: form });
  } catch (e) {
    if (unreachable(e)) return { data: await mockPredict(photo, context), source: "demo" };
    throw e;
  }
  if (!res.ok) {
    const body = await res.text();
    if (unreachable(null, res, body)) return { data: await mockPredict(photo, context), source: "demo" };
    throw new ApiError(res.status, errorText(res, body));
  }
  return { data: await res.json(), source: "model" };
}

export async function risk(req: RiskRequest): Promise<{ data: RiskResponse; source: Source }> {
  if (FORCE_MOCK) return { data: await mockRisk(req), source: "demo" };
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/risk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch (e) {
    if (unreachable(e)) return { data: await mockRisk(req), source: "demo" };
    throw e;
  }
  if (!res.ok) {
    const body = await res.text();
    if (unreachable(null, res, body)) return { data: await mockRisk(req), source: "demo" };
    throw new ApiError(res.status, errorText(res, body));
  }
  return { data: await res.json(), source: "model" };
}

async function postJson<Req, Res>(path: string, req: Req, mock: (r: Req) => Promise<Res>): Promise<{ data: Res; source: Source }> {
  if (FORCE_MOCK) return { data: await mock(req), source: "demo" };
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) });
  } catch (e) {
    if (unreachable(e)) return { data: await mock(req), source: "demo" };
    throw e;
  }
  if (!res.ok) {
    const body = await res.text();
    if (unreachable(null, res, body)) return { data: await mock(req), source: "demo" };
    throw new ApiError(res.status, errorText(res, body));
  }
  return { data: await res.json(), source: "model" };
}

export const coachQuests = (req: QuestsRequest) => postJson("/api/quests", req, mockQuests);
export const mealIdeas = (req: MealIdeasRequest) => postJson("/api/meal-ideas", req, mockMealIdeas);
